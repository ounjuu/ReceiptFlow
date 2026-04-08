"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import { usePagination } from "@/lib/usePagination";
import { Pagination } from "@/lib/Pagination";
import styles from "./DepreciationSchedule.module.css";

interface DepreciationAsset {
  id: string;
  name: string;
  assetAccountCode: string;
  assetAccountName: string;
  acquisitionDate: string;
  acquisitionCost: number;
  usefulLifeMonths: number;
  depreciationMethod: string;
  residualValue: number;
  prevAccumulatedDep: number;
  prevBookValue: number;
  currentYearDep: number;
  currentAccumulatedDep: number;
  currentBookValue: number;
  depRate: number;
  status: string;
}

interface DepreciationScheduleData {
  year: number;
  assets: DepreciationAsset[];
  totals: {
    acquisitionCost: number;
    prevAccumulatedDep: number;
    prevBookValue: number;
    currentYearDep: number;
    currentAccumulatedDep: number;
    currentBookValue: number;
  };
}

const METHOD_LABEL: Record<string, string> = {
  STRAIGHT_LINE: "정액법",
  DECLINING_BALANCE: "정률법",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "사용중",
  FULLY_DEPRECIATED: "상각완료",
  DISPOSED: "처분",
};

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: "badgeActive",
  FULLY_DEPRECIATED: "badgeFully",
  DISPOSED: "badgeDisposed",
};

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString("ko-KR", { maximumFractionDigits: 0 });

const now = new Date();

export default function DepreciationSchedulePage() {
  const { tenantId } = useAuth();
  const [year, setYear] = useState(now.getFullYear());

  const { data, isLoading } = useQuery({
    queryKey: ["depreciation-schedule", tenantId, year],
    queryFn: () =>
      apiGet<DepreciationScheduleData>(
        `/reports/depreciation-schedule?tenantId=${tenantId}&year=${year}`,
      ),
    enabled: !!tenantId,
  });

  // 연도 옵션 (현재 -5 ~ +1)
  const yearOptions: number[] = [];
  for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 5; y--) {
    yearOptions.push(y);
  }

  const handleExport = () => {
    if (!data) return;
    const headers = [
      "자산명",
      "자산계정",
      "취득일",
      "취득가액",
      "상각방법",
      "내용연수(월)",
      "상각률(%)",
      "전기말누계",
      "전기말장부가",
      "당기상각",
      "당기말누계",
      "당기말장부가",
      "상태",
    ];
    const rows = data.assets.map((a) => [
      a.name,
      `${a.assetAccountCode} ${a.assetAccountName}`,
      a.acquisitionDate,
      a.acquisitionCost,
      METHOD_LABEL[a.depreciationMethod] || a.depreciationMethod,
      a.usefulLifeMonths,
      a.depRate,
      a.prevAccumulatedDep,
      a.prevBookValue,
      a.currentYearDep,
      a.currentAccumulatedDep,
      a.currentBookValue,
      STATUS_LABEL[a.status] || a.status,
    ]);
    // 합계 행
    rows.push([
      "합계",
      "",
      "",
      data.totals.acquisitionCost,
      "",
      "",
      "",
      data.totals.prevAccumulatedDep,
      data.totals.prevBookValue,
      data.totals.currentYearDep,
      data.totals.currentAccumulatedDep,
      data.totals.currentBookValue,
      "",
    ]);
    exportToXlsx(`감가상각명세서_${year}`, "감가상각명세서", headers, rows);
  };

  const assets = data?.assets || [];
  const totals = data?.totals;
  const { pageData: pagedAssets, page, totalPages, total, setPage } = usePagination(assets, 50);

  return (
    <div>
      <h1 className={styles.title}>감가상각 명세서</h1>
      <p className={styles.subtitle}>
        고정자산의 감가상각 현황을 연도별로 조회합니다
      </p>

      {/* 연도 선택 */}
      <div className={styles.yearSelector}>
        <span className={styles.yearLabel}>회계연도</span>
        <select
          className={styles.yearSelect}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>
      </div>

      {/* 요약 카드 */}
      {totals && (
        <div className={styles.summaryCards}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>총 자산 수</div>
            <div className={styles.summaryValue}>{assets.length}건</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>총 취득가액</div>
            <div className={styles.summaryValue}>{fmt(totals.acquisitionCost)}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>당기 상각액</div>
            <div className={styles.summaryValue}>{fmt(totals.currentYearDep)}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>당기말 장부가액</div>
            <div className={styles.summaryValue}>{fmt(totals.currentBookValue)}</div>
          </div>
        </div>
      )}

      {/* 테이블 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            {year}년 감가상각 명세
          </div>
          <div className={styles.sectionHeaderRight}>
            <span className={styles.unit}>(단위: 원)</span>
            {assets.length > 0 && (
              <button className={styles.downloadBtn} onClick={handleExport}>
                Excel 다운로드
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className={styles.loading}>데이터를 불러오는 중...</div>
        ) : assets.length === 0 ? (
          <div className={styles.empty}>
            해당 연도에 감가상각 대상 자산이 없습니다
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>자산명</th>
                <th>자산계정</th>
                <th>취득일</th>
                <th>취득가액</th>
                <th>상각방법</th>
                <th>내용연수</th>
                <th>상각률</th>
                <th>전기말누계</th>
                <th>전기말장부가</th>
                <th>당기상각</th>
                <th>당기말누계</th>
                <th>당기말장부가</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {pagedAssets.map((asset) => (
                <tr key={asset.id}>
                  <td>{asset.name}</td>
                  <td className={styles.textCenter}>
                    {asset.assetAccountCode} {asset.assetAccountName}
                  </td>
                  <td className={styles.textCenter}>{asset.acquisitionDate}</td>
                  <td className={styles.textRight}>{fmt(asset.acquisitionCost)}</td>
                  <td className={styles.textCenter}>
                    {METHOD_LABEL[asset.depreciationMethod] || asset.depreciationMethod}
                  </td>
                  <td className={styles.textCenter}>
                    {Math.floor(asset.usefulLifeMonths / 12)}년
                    {asset.usefulLifeMonths % 12 > 0
                      ? ` ${asset.usefulLifeMonths % 12}개월`
                      : ""}
                  </td>
                  <td className={styles.textRight}>{asset.depRate}%</td>
                  <td className={styles.textRight}>{fmt(asset.prevAccumulatedDep)}</td>
                  <td className={styles.textRight}>{fmt(asset.prevBookValue)}</td>
                  <td className={styles.textRight}>{fmt(asset.currentYearDep)}</td>
                  <td className={styles.textRight}>{fmt(asset.currentAccumulatedDep)}</td>
                  <td className={styles.textRight}>{fmt(asset.currentBookValue)}</td>
                  <td className={styles.textCenter}>
                    <span
                      className={`${styles.badge} ${styles[STATUS_CLASS[asset.status] || ""]}`}
                    >
                      {STATUS_LABEL[asset.status] || asset.status}
                    </span>
                  </td>
                </tr>
              ))}
              {/* 합계 행 */}
              {totals && (
                <tr className={styles.totalRow}>
                  <td>합계</td>
                  <td></td>
                  <td></td>
                  <td className={styles.textRight}>{fmt(totals.acquisitionCost)}</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td className={styles.textRight}>{fmt(totals.prevAccumulatedDep)}</td>
                  <td className={styles.textRight}>{fmt(totals.prevBookValue)}</td>
                  <td className={styles.textRight}>{fmt(totals.currentYearDep)}</td>
                  <td className={styles.textRight}>{fmt(totals.currentAccumulatedDep)}</td>
                  <td className={styles.textRight}>{fmt(totals.currentBookValue)}</td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {assets.length > 0 && (
          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        )}
      </div>
    </div>
  );
}

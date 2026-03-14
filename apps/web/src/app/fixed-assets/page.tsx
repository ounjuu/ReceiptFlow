"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./page.module.css";

interface FixedAssetSummary {
  id: string;
  name: string;
  description: string | null;
  assetAccountCode: string;
  assetAccountName: string;
  acquisitionDate: string;
  acquisitionCost: number;
  usefulLifeMonths: number;
  residualValue: number;
  depreciationMethod: string;
  status: string;
  accumulatedDep: number;
  bookValue: number;
}

interface DepRecord {
  id: string;
  period: string;
  amount: number;
  accumulatedAmount: number;
  bookValue: number;
  journalEntryId: string | null;
}

interface FixedAssetDetail {
  id: string;
  name: string;
  description: string | null;
  assetAccount: { code: string; name: string };
  depreciationAccount: { code: string; name: string };
  accumulatedDepAccount: { code: string; name: string };
  acquisitionDate: string;
  acquisitionCost: number;
  usefulLifeMonths: number;
  residualValue: number;
  depreciationMethod: string;
  status: string;
  disposalDate: string | null;
  disposalAmount: number | null;
  depreciationRecords: DepRecord[];
}

interface ScheduleRow {
  period: string;
  amount: number;
  accumulatedAmount: number;
  bookValue: number;
  isActual: boolean;
}

interface ScheduleData {
  assetName: string;
  acquisitionCost: number;
  residualValue: number;
  usefulLifeMonths: number;
  depreciationMethod: string;
  schedule: ScheduleRow[];
}

interface AccountOption {
  id: string;
  code: string;
  name: string;
}

interface DepResult {
  period: string;
  processedCount: number;
  totalAmount: number;
  details: { assetId: string; assetName: string; amount: number }[];
}

const fmt = (n: number) => n.toLocaleString();

const METHOD_LABEL: Record<string, string> = {
  STRAIGHT_LINE: "정액법",
  DECLINING_BALANCE: "정률법",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "사용중",
  DISPOSED: "처분",
  FULLY_DEPRECIATED: "상각완료",
};

const now = new Date();

export default function FixedAssetsPage() {
  const { tenantId, canEdit, canDelete } = useAuth();
  const queryClient = useQueryClient();

  const [view, setView] = useState<"list" | "form" | "detail">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);

  // 등록 폼
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formAssetAccountId, setFormAssetAccountId] = useState("");
  const [formDepAccountId, setFormDepAccountId] = useState("");
  const [formAccumAccountId, setFormAccumAccountId] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formCost, setFormCost] = useState("");
  const [formLifeMonths, setFormLifeMonths] = useState("");
  const [formResidual, setFormResidual] = useState("0");
  const [formMethod, setFormMethod] = useState("STRAIGHT_LINE");

  // 감가상각 실행
  const [depYear, setDepYear] = useState(now.getFullYear());
  const [depMonth, setDepMonth] = useState(now.getMonth() + 1);

  // 처분
  const [disposeDate, setDisposeDate] = useState("");
  const [disposeAmount, setDisposeAmount] = useState("");
  const [showDispose, setShowDispose] = useState(false);

  // 자산 목록
  const { data: assets = [] } = useQuery({
    queryKey: ["fixed-assets"],
    queryFn: () =>
      apiGet<FixedAssetSummary[]>(`/fixed-assets?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  // 계정과목 (자산 계정: 13xxx)
  const { data: allAccounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: () =>
      apiGet<AccountOption[]>(`/accounts?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  const assetAccounts = allAccounts.filter((a) => a.code.startsWith("13") && !a.code.startsWith("136"));
  const depExpenseAccounts = allAccounts.filter((a) => a.code === "50900");
  const accumDepAccounts = allAccounts.filter((a) => a.code === "13600");

  // 자산 상세
  const { data: detail } = useQuery({
    queryKey: ["fixed-asset-detail", selectedId],
    queryFn: () =>
      apiGet<FixedAssetDetail>(`/fixed-assets/${selectedId}`),
    enabled: !!selectedId,
  });

  // 감가상각 스케줄
  const { data: schedule } = useQuery({
    queryKey: ["fixed-asset-schedule", selectedId],
    queryFn: () =>
      apiGet<ScheduleData>(`/fixed-assets/${selectedId}/schedule`),
    enabled: !!selectedId && showSchedule,
  });

  // 등록
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPost("/fixed-assets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixed-assets"] });
      resetForm();
      setView("list");
    },
  });

  // 감가상각 실행
  const depMutation = useMutation({
    mutationFn: (data: { tenantId: string; year: number; month: number }) =>
      apiPost<DepResult>("/fixed-assets/depreciation", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixed-assets"] });
      queryClient.invalidateQueries({ queryKey: ["fixed-asset-detail"] });
      queryClient.invalidateQueries({ queryKey: ["fixed-asset-schedule"] });
    },
  });

  // 처분
  const disposeMutation = useMutation({
    mutationFn: (data: { disposalDate: string; disposalAmount: number }) =>
      apiPost(`/fixed-assets/${selectedId}/dispose`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixed-assets"] });
      queryClient.invalidateQueries({ queryKey: ["fixed-asset-detail"] });
      setShowDispose(false);
    },
  });

  const resetForm = () => {
    setFormName("");
    setFormDesc("");
    setFormAssetAccountId("");
    setFormDepAccountId("");
    setFormAccumAccountId("");
    setFormDate("");
    setFormCost("");
    setFormLifeMonths("");
    setFormResidual("0");
    setFormMethod("STRAIGHT_LINE");
  };

  const handleCreate = () => {
    if (!formName || !formAssetAccountId || !formDepAccountId || !formAccumAccountId || !formDate || !formCost || !formLifeMonths) return;
    createMutation.mutate({
      tenantId,
      name: formName,
      description: formDesc || undefined,
      assetAccountId: formAssetAccountId,
      depreciationAccountId: formDepAccountId,
      accumulatedDepAccountId: formAccumAccountId,
      acquisitionDate: formDate,
      acquisitionCost: Number(formCost),
      usefulLifeMonths: Number(formLifeMonths),
      residualValue: Number(formResidual) || 0,
      depreciationMethod: formMethod,
    });
  };

  const handleRunDep = () => {
    if (!tenantId) return;
    depMutation.mutate({ tenantId, year: depYear, month: depMonth });
  };

  const handleDispose = () => {
    if (!disposeDate || !disposeAmount) return;
    disposeMutation.mutate({
      disposalDate: disposeDate,
      disposalAmount: Number(disposeAmount),
    });
  };

  // 요약 계산
  const totalAssets = assets.length;
  const totalCost = assets.reduce((s, a) => s + a.acquisitionCost, 0);
  const totalAccDep = assets.reduce((s, a) => s + a.accumulatedDep, 0);
  const totalBookValue = assets.reduce((s, a) => s + a.bookValue, 0);

  // 엑셀 내보내기
  const exportAssets = () => {
    exportToXlsx(
      "고정자산목록",
      "자산목록",
      ["자산명", "계정", "취득일", "취득원가", "상각방법", "감가상각누계", "장부가액", "상태"],
      assets.map((a) => [
        a.name,
        `${a.assetAccountCode} ${a.assetAccountName}`,
        new Date(a.acquisitionDate).toLocaleDateString("ko-KR"),
        a.acquisitionCost,
        METHOD_LABEL[a.depreciationMethod] || a.depreciationMethod,
        a.accumulatedDep,
        a.bookValue,
        STATUS_LABEL[a.status] || a.status,
      ]),
    );
  };

  const exportScheduleXlsx = () => {
    if (!schedule) return;
    exportToXlsx(
      `감가상각스케줄_${schedule.assetName}`,
      "스케줄",
      ["기간", "감가상각액", "누적상각액", "장부가액", "구분"],
      schedule.schedule.map((r) => [
        r.period,
        r.amount,
        r.accumulatedAmount,
        r.bookValue,
        r.isActual ? "실적" : "예상",
      ]),
    );
  };

  // 자동 계정 선택 (편의)
  const autoSelectAccounts = () => {
    if (depExpenseAccounts.length > 0 && !formDepAccountId) {
      setFormDepAccountId(depExpenseAccounts[0].id);
    }
    if (accumDepAccounts.length > 0 && !formAccumAccountId) {
      setFormAccumAccountId(accumDepAccounts[0].id);
    }
  };

  return (
    <div>
      <h1 className={styles.title}>고정자산 관리</h1>
      <p className={styles.subtitle}>
        고정자산 등록, 감가상각 자동 계산 및 내용연수를 관리하세요
      </p>

      {/* 요약 카드 */}
      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>총 자산 수</div>
          <div className={styles.summaryValue}>{totalAssets}건</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>총 취득원가</div>
          <div className={styles.summaryValue}>₩{fmt(totalCost)}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>총 감가상각누계</div>
          <div className={styles.summaryValue}>₩{fmt(totalAccDep)}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>총 장부가액</div>
          <div className={styles.summaryValue}>₩{fmt(totalBookValue)}</div>
        </div>
      </div>

      {/* 감가상각 일괄 실행 */}
      {canEdit && view === "list" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>월별 감가상각 실행</h2>
          </div>
          <div className={styles.depControls}>
            <select
              className={styles.depSelect}
              value={depYear}
              onChange={(e) => setDepYear(Number(e.target.value))}
            >
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(
                (y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ),
              )}
            </select>
            <select
              className={styles.depSelect}
              value={depMonth}
              onChange={(e) => setDepMonth(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>
            <button
              className={styles.primaryBtn}
              onClick={handleRunDep}
              disabled={depMutation.isPending}
            >
              {depMutation.isPending ? "처리 중..." : "감가상각 실행"}
            </button>
            {depMutation.data && (
              <span style={{ fontSize: "0.85rem", color: "var(--success)" }}>
                {depMutation.data.processedCount}건 처리 완료 (₩
                {fmt(depMutation.data.totalAmount)})
              </span>
            )}
          </div>
        </div>
      )}

      {/* 목록 뷰 */}
      {view === "list" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>자산 목록</h2>
            <div className={styles.sectionHeaderRight}>
              <span className={styles.unit}>(단위: 원)</span>
              <button
                className={styles.downloadBtn}
                onClick={exportAssets}
                disabled={assets.length === 0}
              >
                엑셀 다운로드
              </button>
              {canEdit && (
                <button
                  className={styles.primaryBtn}
                  onClick={() => {
                    autoSelectAccounts();
                    setView("form");
                  }}
                >
                  자산 등록
                </button>
              )}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>자산명</th>
                <th>계정</th>
                <th>취득일</th>
                <th style={{ textAlign: "right" }}>취득원가</th>
                <th>상각방법</th>
                <th style={{ textAlign: "right" }}>감가상각누계</th>
                <th style={{ textAlign: "right" }}>장부가액</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr
                  key={a.id}
                  className={styles.clickableRow}
                  onClick={() => {
                    setSelectedId(a.id);
                    setShowSchedule(false);
                    setShowDispose(false);
                    setView("detail");
                  }}
                >
                  <td>{a.name}</td>
                  <td>
                    {a.assetAccountCode} {a.assetAccountName}
                  </td>
                  <td>
                    {new Date(a.acquisitionDate).toLocaleDateString("ko-KR")}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    ₩{fmt(a.acquisitionCost)}
                  </td>
                  <td>{METHOD_LABEL[a.depreciationMethod] || a.depreciationMethod}</td>
                  <td style={{ textAlign: "right" }}>
                    ₩{fmt(a.accumulatedDep)}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>
                    ₩{fmt(a.bookValue)}
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        a.status === "ACTIVE"
                          ? styles.badgeActive
                          : a.status === "DISPOSED"
                            ? styles.badgeDisposed
                            : styles.badgeFully
                      }`}
                    >
                      {STATUS_LABEL[a.status] || a.status}
                    </span>
                  </td>
                </tr>
              ))}
              {assets.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    style={{ textAlign: "center", color: "var(--text-muted)" }}
                  >
                    등록된 고정자산이 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 등록 폼 */}
      {view === "form" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>자산 등록</h2>
          </div>
          <div className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>자산명 *</label>
              <input
                className={styles.formInput}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="예: 사무실 노트북"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>자산 계정 *</label>
              <select
                className={styles.formSelect}
                value={formAssetAccountId}
                onChange={(e) => setFormAssetAccountId(e.target.value)}
              >
                <option value="">선택</option>
                {assetAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>감가상각비 계정 *</label>
              <select
                className={styles.formSelect}
                value={formDepAccountId}
                onChange={(e) => setFormDepAccountId(e.target.value)}
              >
                <option value="">선택</option>
                {depExpenseAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>감가상각누계액 계정 *</label>
              <select
                className={styles.formSelect}
                value={formAccumAccountId}
                onChange={(e) => setFormAccumAccountId(e.target.value)}
              >
                <option value="">선택</option>
                {accumDepAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>취득일 *</label>
              <input
                className={styles.formInput}
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>취득원가 *</label>
              <input
                className={styles.formInput}
                type="number"
                value={formCost}
                onChange={(e) => setFormCost(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>내용연수 (월) *</label>
              <input
                className={styles.formInput}
                type="number"
                value={formLifeMonths}
                onChange={(e) => setFormLifeMonths(e.target.value)}
                placeholder="예: 60 (5년)"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>잔존가치</label>
              <input
                className={styles.formInput}
                type="number"
                value={formResidual}
                onChange={(e) => setFormResidual(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>상각방법 *</label>
              <select
                className={styles.formSelect}
                value={formMethod}
                onChange={(e) => setFormMethod(e.target.value)}
              >
                <option value="STRAIGHT_LINE">정액법</option>
                <option value="DECLINING_BALANCE">정률법</option>
              </select>
            </div>
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>설명</label>
              <input
                className={styles.formInput}
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="선택사항"
              />
            </div>
            <div className={styles.formActions}>
              <button
                className={styles.secondaryBtn}
                onClick={() => {
                  resetForm();
                  setView("list");
                }}
              >
                취소
              </button>
              <button
                className={styles.primaryBtn}
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "등록 중..." : "등록"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상세 뷰 */}
      {view === "detail" && detail && (
        <>
          <div className={styles.detailHeader}>
            <button
              className={styles.secondaryBtn}
              onClick={() => {
                setSelectedId(null);
                setView("list");
              }}
            >
              목록으로
            </button>
            <h2 className={styles.sectionTitle}>{detail.name}</h2>
            <span
              className={`${styles.badge} ${
                detail.status === "ACTIVE"
                  ? styles.badgeActive
                  : detail.status === "DISPOSED"
                    ? styles.badgeDisposed
                    : styles.badgeFully
              }`}
            >
              {STATUS_LABEL[detail.status] || detail.status}
            </span>
          </div>

          {/* 기본 정보 */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>기본 정보</h3>
            <div className={styles.detailInfo}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>자산 계정</span>
                <span className={styles.detailValue}>
                  {detail.assetAccount.code} {detail.assetAccount.name}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>취득일</span>
                <span className={styles.detailValue}>
                  {new Date(detail.acquisitionDate).toLocaleDateString("ko-KR")}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>취득원가</span>
                <span className={styles.detailValue}>
                  ₩{fmt(detail.acquisitionCost)}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>내용연수</span>
                <span className={styles.detailValue}>
                  {detail.usefulLifeMonths}개월 (
                  {(detail.usefulLifeMonths / 12).toFixed(1)}년)
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>잔존가치</span>
                <span className={styles.detailValue}>
                  ₩{fmt(detail.residualValue)}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>상각방법</span>
                <span className={styles.detailValue}>
                  {METHOD_LABEL[detail.depreciationMethod] ||
                    detail.depreciationMethod}
                </span>
              </div>
              {detail.description && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>설명</span>
                  <span className={styles.detailValue}>
                    {detail.description}
                  </span>
                </div>
              )}
              {detail.disposalDate && (
                <>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>처분일</span>
                    <span className={styles.detailValue}>
                      {new Date(detail.disposalDate).toLocaleDateString(
                        "ko-KR",
                      )}
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>처분금액</span>
                    <span className={styles.detailValue}>
                      ₩{fmt(detail.disposalAmount || 0)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* 처분 */}
            {detail.status === "ACTIVE" && canDelete && (
              <>
                {!showDispose ? (
                  <button
                    className={styles.dangerBtn}
                    onClick={() => setShowDispose(true)}
                  >
                    자산 처분
                  </button>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                    }}
                  >
                    <input
                      className={styles.formInput}
                      type="date"
                      value={disposeDate}
                      onChange={(e) => setDisposeDate(e.target.value)}
                      placeholder="처분일"
                    />
                    <input
                      className={styles.formInput}
                      type="number"
                      value={disposeAmount}
                      onChange={(e) => setDisposeAmount(e.target.value)}
                      placeholder="처분금액"
                    />
                    <button
                      className={styles.dangerBtn}
                      onClick={handleDispose}
                      disabled={disposeMutation.isPending}
                    >
                      처분 확인
                    </button>
                    <button
                      className={styles.secondaryBtn}
                      onClick={() => setShowDispose(false)}
                    >
                      취소
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 감가상각 이력 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>감가상각 이력</h3>
              <div className={styles.sectionHeaderRight}>
                <span className={styles.unit}>(단위: 원)</span>
                <button
                  className={styles.secondaryBtn}
                  onClick={() => setShowSchedule(!showSchedule)}
                >
                  {showSchedule ? "이력만 보기" : "스케줄 보기"}
                </button>
                {showSchedule && schedule && (
                  <button
                    className={styles.downloadBtn}
                    onClick={exportScheduleXlsx}
                  >
                    스케줄 엑셀
                  </button>
                )}
              </div>
            </div>

            {!showSchedule ? (
              <table>
                <thead>
                  <tr>
                    <th>기간</th>
                    <th style={{ textAlign: "right" }}>감가상각액</th>
                    <th style={{ textAlign: "right" }}>누적상각액</th>
                    <th style={{ textAlign: "right" }}>장부가액</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.depreciationRecords.map((r) => (
                    <tr key={r.id}>
                      <td>{r.period}</td>
                      <td style={{ textAlign: "right" }}>
                        ₩{fmt(r.amount)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        ₩{fmt(r.accumulatedAmount)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        ₩{fmt(r.bookValue)}
                      </td>
                    </tr>
                  ))}
                  {detail.depreciationRecords.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          textAlign: "center",
                          color: "var(--text-muted)",
                        }}
                      >
                        감가상각 이력이 없습니다
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : schedule ? (
              <table>
                <thead>
                  <tr>
                    <th>기간</th>
                    <th style={{ textAlign: "right" }}>감가상각액</th>
                    <th style={{ textAlign: "right" }}>누적상각액</th>
                    <th style={{ textAlign: "right" }}>장부가액</th>
                    <th>구분</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.schedule.map((r, i) => (
                    <tr
                      key={i}
                      className={
                        r.isActual ? styles.actualRow : styles.projectedRow
                      }
                    >
                      <td>{r.period}</td>
                      <td style={{ textAlign: "right" }}>
                        ₩{fmt(Math.round(r.amount))}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        ₩{fmt(Math.round(r.accumulatedAmount))}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        ₩{fmt(Math.round(r.bookValue))}
                      </td>
                      <td>{r.isActual ? "실적" : "예상"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>불러오는 중...</p>
            )}

            {/* 요약 바 */}
            {detail.depreciationRecords.length > 0 && (
              <div className={styles.summaryBar}>
                <div className={styles.summaryBarItem}>
                  <span className={styles.summaryBarLabel}>취득원가</span>
                  <span className={styles.summaryBarValue}>
                    ₩{fmt(detail.acquisitionCost)}
                  </span>
                </div>
                <div className={styles.summaryBarItem}>
                  <span className={styles.summaryBarLabel}>감가상각누계</span>
                  <span className={styles.summaryBarValue}>
                    ₩
                    {fmt(
                      detail.depreciationRecords[
                        detail.depreciationRecords.length - 1
                      ].accumulatedAmount,
                    )}
                  </span>
                </div>
                <div className={styles.summaryBarItem}>
                  <span className={styles.summaryBarLabel}>장부가액</span>
                  <span className={styles.summaryBarValue}>
                    ₩
                    {fmt(
                      detail.depreciationRecords[
                        detail.depreciationRecords.length - 1
                      ].bookValue,
                    )}
                  </span>
                </div>
                <div className={styles.summaryBarItem}>
                  <span className={styles.summaryBarLabel}>잔존가치</span>
                  <span className={styles.summaryBarValue}>
                    ₩{fmt(detail.residualValue)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

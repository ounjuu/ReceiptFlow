"use client";

import styles from "./FixedAssets.module.css";
import type { FixedAssetSummary, FixedAssetDetail, ScheduleData, DepResult } from "./types";
import { fmt, METHOD_LABEL, STATUS_LABEL } from "./types";

interface FixedAssetTableProps {
  // 목록 뷰 props
  assets: FixedAssetSummary[];
  canEdit: boolean;
  canDelete: boolean;
  onAssetClick: (id: string) => void;
  onRegisterClick: () => void;
  onExportAssets: () => void;

  // 감가상각 실행 props
  depYear: number;
  setDepYear: (v: number) => void;
  depMonth: number;
  setDepMonth: (v: number) => void;
  onRunDep: () => void;
  depIsPending: boolean;
  depResult: DepResult | undefined;

  // 상세 뷰 props
  view: "list" | "form" | "detail";
  detail: FixedAssetDetail | undefined;
  onBackToList: () => void;

  // 처분 props
  showDispose: boolean;
  setShowDispose: (v: boolean) => void;
  disposeDate: string;
  setDisposeDate: (v: string) => void;
  disposeAmount: string;
  setDisposeAmount: (v: string) => void;
  onDispose: () => void;
  disposeIsPending: boolean;

  // 스케줄 props
  showSchedule: boolean;
  setShowSchedule: (v: boolean) => void;
  schedule: ScheduleData | undefined;
  onExportSchedule: () => void;

  // 요약
  totalAssets: number;
  totalCost: number;
  totalAccDep: number;
  totalBookValue: number;
}

const now = new Date();

export default function FixedAssetTable({
  assets,
  canEdit,
  canDelete,
  onAssetClick,
  onRegisterClick,
  onExportAssets,
  depYear,
  setDepYear,
  depMonth,
  setDepMonth,
  onRunDep,
  depIsPending,
  depResult,
  view,
  detail,
  onBackToList,
  showDispose,
  setShowDispose,
  disposeDate,
  setDisposeDate,
  disposeAmount,
  setDisposeAmount,
  onDispose,
  disposeIsPending,
  showSchedule,
  setShowSchedule,
  schedule,
  onExportSchedule,
  totalAssets,
  totalCost,
  totalAccDep,
  totalBookValue,
}: FixedAssetTableProps) {
  return (
    <>
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
              onClick={onRunDep}
              disabled={depIsPending}
            >
              {depIsPending ? "처리 중..." : "감가상각 실행"}
            </button>
            {depResult && (
              <span style={{ fontSize: "0.85rem", color: "var(--success)" }}>
                {depResult.processedCount}건 처리 완료 (₩
                {fmt(depResult.totalAmount)})
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
                onClick={onExportAssets}
                disabled={assets.length === 0}
              >
                엑셀 다운로드
              </button>
              {canEdit && (
                <button
                  className={styles.primaryBtn}
                  onClick={onRegisterClick}
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
                  onClick={() => onAssetClick(a.id)}
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

      {/* 상세 뷰 */}
      {view === "detail" && detail && (
        <>
          <div className={styles.detailHeader}>
            <button
              className={styles.secondaryBtn}
              onClick={onBackToList}
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
                      onClick={onDispose}
                      disabled={disposeIsPending}
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
                    onClick={onExportSchedule}
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
    </>
  );
}

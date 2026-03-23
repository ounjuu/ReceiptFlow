"use client";

import styles from "./ExpenseClaims.module.css";
import { ExpenseClaim, Summary, STATUS_LABEL, STATUS_STYLE, fmt } from "./types";

export interface ExpenseClaimTableProps {
  // 요약
  summary: Summary | undefined;
  // 탭
  tab: "create" | "list" | "settle";
  onTabChange: (tab: "create" | "list" | "settle") => void;
  canEdit: boolean;
  // 목록
  claims: ExpenseClaim[];
  filterStatus: string;
  onFilterStatusChange: (value: string) => void;
  onExport: () => void;
  onSubmit: (id: string) => void;
  isSubmitting: boolean;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  // 정산
  approvedClaims: ExpenseClaim[];
  settledClaims: ExpenseClaim[];
  onOpenSettleModal: (claim: ExpenseClaim) => void;
  // 정산 모달
  settleModal: ExpenseClaim | null;
  onCloseSettleModal: () => void;
  settleDebit: string;
  onSettleDebitChange: (value: string) => void;
  settleCredit: string;
  onSettleCreditChange: (value: string) => void;
  onSettle: () => void;
  isSettling: boolean;
}

export default function ExpenseClaimTable({
  summary,
  tab,
  onTabChange,
  canEdit,
  claims,
  filterStatus,
  onFilterStatusChange,
  onExport,
  onSubmit,
  isSubmitting,
  onDelete,
  isDeleting,
  approvedClaims,
  settledClaims,
  onOpenSettleModal,
  settleModal,
  onCloseSettleModal,
  settleDebit,
  onSettleDebitChange,
  settleCredit,
  onSettleCreditChange,
  onSettle,
  isSettling,
}: ExpenseClaimTableProps) {
  return (
    <>
      {/* 요약 카드 */}
      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>결재 대기</div>
          <div className={styles.summaryValue}>{summary?.pending ?? 0}건</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>승인 (미정산)</div>
          <div className={styles.summaryValue}>{summary?.approved ?? 0}건</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>정산 완료</div>
          <div className={styles.summaryValue}>{fmt(summary?.totalSettled ?? 0)}원</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>미정산 금액</div>
          <div className={styles.summaryValue}>{fmt(summary?.totalPending ?? 0)}원</div>
        </div>
      </div>

      {/* 탭 */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "create" ? styles.tabActive : ""}`}
          onClick={() => onTabChange("create")}
        >
          경비 신청
        </button>
        <button
          className={`${styles.tab} ${tab === "list" ? styles.tabActive : ""}`}
          onClick={() => onTabChange("list")}
        >
          신청 현황
        </button>
        {canEdit && (
          <button
            className={`${styles.tab} ${tab === "settle" ? styles.tabActive : ""}`}
            onClick={() => onTabChange("settle")}
          >
            경비 처리
          </button>
        )}
      </div>

      {/* 신청 현황 탭 */}
      {tab === "list" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>신청 현황</h2>
            <button className={styles.downloadBtn} onClick={onExport}>
              엑셀 다운로드
            </button>
          </div>

          <div className={styles.filterRow}>
            <select
              className={styles.filterSelect}
              value={filterStatus}
              onChange={(e) => onFilterStatusChange(e.target.value)}
            >
              <option value="">전체 상태</option>
              <option value="DRAFT">임시저장</option>
              <option value="PENDING_APPROVAL">결재중</option>
              <option value="APPROVED">승인</option>
              <option value="REJECTED">반려</option>
              <option value="SETTLED">정산완료</option>
            </select>
          </div>

          <table>
            <thead>
              <tr>
                <th>신청번호</th>
                <th>제목</th>
                <th>직원</th>
                <th>신청일</th>
                <th>합계</th>
                <th>상태</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c.id}>
                  <td>{c.claimNo}</td>
                  <td>{c.title}</td>
                  <td>{c.employee.name}</td>
                  <td>{new Date(c.claimDate).toLocaleDateString("ko-KR")}</td>
                  <td style={{ textAlign: "right" }}>{fmt(c.totalAmount)}원</td>
                  <td>
                    <span className={`${styles.badge} ${styles[STATUS_STYLE[c.status]] || ""}`}>
                      {STATUS_LABEL[c.status] || c.status}
                    </span>
                  </td>
                  <td>
                    {c.status === "DRAFT" && (
                      <>
                        <button
                          className={styles.primaryBtn}
                          style={{ fontSize: "0.8rem", padding: "4px 10px", marginRight: "4px" }}
                          onClick={() => onSubmit(c.id)}
                          disabled={isSubmitting}
                        >
                          결재요청
                        </button>
                        <button
                          className={styles.dangerBtn}
                          onClick={() => {
                            if (confirm("삭제하시겠습니까?")) onDelete(c.id);
                          }}
                          disabled={isDeleting}
                        >
                          삭제
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {claims.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                    경비 신청 내역이 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 경비 처리 탭 */}
      {tab === "settle" && canEdit && (
        <>
          {/* 승인 건 정산 처리 */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>승인 건 정산 대기</h2>
            <table>
              <thead>
                <tr>
                  <th>신청번호</th>
                  <th>제목</th>
                  <th>직원</th>
                  <th>합계</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {approvedClaims.map((c) => (
                  <tr key={c.id}>
                    <td>{c.claimNo}</td>
                    <td>{c.title}</td>
                    <td>{c.employee.name}</td>
                    <td style={{ textAlign: "right" }}>{fmt(c.totalAmount)}원</td>
                    <td>
                      <button className={styles.settleBtn} onClick={() => onOpenSettleModal(c)}>
                        정산 처리
                      </button>
                    </td>
                  </tr>
                ))}
                {approvedClaims.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                      정산 대기 건이 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 정산 완료 내역 */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>정산 완료 내역</h2>
            <table>
              <thead>
                <tr>
                  <th>신청번호</th>
                  <th>제목</th>
                  <th>직원</th>
                  <th>합계</th>
                  <th>정산일</th>
                </tr>
              </thead>
              <tbody>
                {settledClaims.map((c) => (
                  <tr key={c.id}>
                    <td>{c.claimNo}</td>
                    <td>{c.title}</td>
                    <td>{c.employee.name}</td>
                    <td style={{ textAlign: "right" }}>{fmt(c.totalAmount)}원</td>
                    <td>{c.settledAt ? new Date(c.settledAt).toLocaleDateString("ko-KR") : "-"}</td>
                  </tr>
                ))}
                {settledClaims.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                      정산 완료 내역이 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 정산 모달 */}
      {settleModal && (
        <div className={styles.modalOverlay} onClick={onCloseSettleModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>정산 처리</h3>
            <p style={{ marginBottom: "12px", fontSize: "0.9rem" }}>
              <strong>{settleModal.title}</strong> ({settleModal.claimNo})<br />
              금액: {fmt(settleModal.totalAmount)}원
            </p>
            <div className={styles.formGroup} style={{ marginBottom: "12px" }}>
              <label className={styles.formLabel}>차변 계정 (경비)</label>
              <input
                className={styles.formInput}
                value={settleDebit}
                onChange={(e) => onSettleDebitChange(e.target.value)}
                placeholder="50800"
              />
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>기본: 50800 복리후생비</span>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>대변 계정</label>
              <input
                className={styles.formInput}
                value={settleCredit}
                onChange={(e) => onSettleCreditChange(e.target.value)}
                placeholder="25300"
              />
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>기본: 25300 미지급금</span>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.secondaryBtn} onClick={onCloseSettleModal}>
                취소
              </button>
              <button
                className={styles.primaryBtn}
                onClick={onSettle}
                disabled={isSettling}
              >
                정산 실행
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

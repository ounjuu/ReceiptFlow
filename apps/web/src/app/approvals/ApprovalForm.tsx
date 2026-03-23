"use client";

import styles from "./Approvals.module.css";
import type { ApprovalLine, Member } from "./types";

export interface ApprovalFormProps {
  lineDocType: string;
  onLineDocTypeChange: (value: string) => void;
  filteredLines: ApprovalLine[];
  members: Member[];
  newApproverId: string;
  onNewApproverIdChange: (value: string) => void;
  onAddLine: () => void;
  onRemoveLine: (step: number) => void;
  isSaving: boolean;
}

export function ApprovalForm({
  lineDocType,
  onLineDocTypeChange,
  filteredLines,
  members,
  newApproverId,
  onNewApproverIdChange,
  onAddLine,
  onRemoveLine,
  isSaving,
}: ApprovalFormProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>결재선 설정</h2>
      </div>

      <div className={styles.formRow} style={{ marginBottom: "16px" }}>
        <span className={styles.formLabel}>문서 유형</span>
        <select
          className={styles.formSelect}
          value={lineDocType}
          onChange={(e) => onLineDocTypeChange(e.target.value)}
        >
          <option value="JOURNAL">전표</option>
          <option value="TAX_INVOICE">세금계산서</option>
          <option value="EXPENSE_CLAIM">경비 정산</option>
        </select>
      </div>

      <div className={styles.lineList}>
        {filteredLines.map((l) => (
          <div key={l.id} className={styles.lineItem}>
            <span className={styles.lineStep}>{l.step}단계</span>
            <span className={styles.lineName}>
              {l.approver.name} ({l.approver.email})
            </span>
            <button
              className={styles.lineRemove}
              onClick={() => onRemoveLine(l.step)}
            >
              ×
            </button>
          </div>
        ))}
        {filteredLines.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            결재선이 설정되지 않았습니다. 결재선이 없으면 기존 방식(직접 상태
            변경)으로 동작합니다.
          </p>
        )}
      </div>

      <div className={styles.formRow}>
        <span className={styles.formLabel}>결재자 추가</span>
        <select
          className={styles.formSelect}
          value={newApproverId}
          onChange={(e) => onNewApproverIdChange(e.target.value)}
        >
          <option value="">선택</option>
          {members
            .filter((m) => m.role !== "VIEWER")
            .map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name} ({m.email}) - {m.role}
              </option>
            ))}
        </select>
        <button
          className={styles.primaryBtn}
          onClick={onAddLine}
          disabled={!newApproverId || isSaving}
        >
          추가
        </button>
      </div>
    </div>
  );
}

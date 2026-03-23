"use client";

import type { JournalRule } from "./types";
import styles from "./JournalRules.module.css";

interface JournalRuleTableProps {
  rules: JournalRule[];
  canEdit: boolean;
  onEdit: (rule: JournalRule) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
}

function fmtAmount(v: number | null) {
  return v != null ? `₩${Number(v).toLocaleString()}` : "-";
}

export default function JournalRuleTable({
  rules,
  canEdit,
  onEdit,
  onDelete,
  onToggle,
}: JournalRuleTableProps) {
  if (rules.length === 0) {
    return <p className={styles.empty}>등록된 규칙이 없습니다</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>우선순위</th>
          <th>이름</th>
          <th>거래처</th>
          <th>키워드</th>
          <th>금액 범위</th>
          <th>차변</th>
          <th>대변</th>
          <th>상태</th>
          {canEdit && <th>관리</th>}
        </tr>
      </thead>
      <tbody>
        {rules.map((rule) => (
          <tr key={rule.id}>
            <td><span className={styles.priority}>{rule.priority}</span></td>
            <td>{rule.name}</td>
            <td><span className={styles.vendorName}>{rule.vendorName || "전체"}</span></td>
            <td><span className={styles.keywords}>{rule.keywords || "-"}</span></td>
            <td>
              <span className={styles.amountRange}>
                {rule.amountMin != null || rule.amountMax != null
                  ? `${fmtAmount(rule.amountMin)} ~ ${fmtAmount(rule.amountMax)}`
                  : "전체"}
              </span>
            </td>
            <td>{rule.debitAccount.code} {rule.debitAccount.name}</td>
            <td>{rule.creditAccount.code} {rule.creditAccount.name}</td>
            <td>
              <span
                className={styles.enabledBadge}
                data-enabled={String(rule.enabled)}
                style={{ cursor: canEdit ? "pointer" : "default" }}
                onClick={() => canEdit && onToggle(rule.id, !rule.enabled)}
              >
                {rule.enabled ? "활성" : "비활성"}
              </span>
            </td>
            {canEdit && (
              <td>
                <div className={styles.actions}>
                  <button className={styles.editBtn} onClick={() => onEdit(rule)}>수정</button>
                  <button className={styles.deleteBtn} onClick={() => { if (confirm("삭제하시겠습니까?")) onDelete(rule.id); }}>삭제</button>
                </div>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

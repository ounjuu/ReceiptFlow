"use client";

import styles from "./JournalTemplates.module.css";
import { JournalTemplate } from "./types";

export interface JournalTemplateTableProps {
  templates: JournalTemplate[];
  canEdit: boolean;
  canDelete: boolean;
  onApply: (id: string) => void;
  onEdit: (template: JournalTemplate) => void;
  onDelete: (id: string) => void;
}

export default function JournalTemplateTable({
  templates,
  canEdit,
  canDelete,
  onApply,
  onEdit,
  onDelete,
}: JournalTemplateTableProps) {
  return (
    <div className={styles.tableSection}>
      <h2 className={styles.sectionTitle}>템플릿 목록</h2>
      {templates.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>설명</th>
              <th>라인 수</th>
              <th>차변 합계</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => {
              const tDebit = t.lines.reduce((s, l) => s + Number(l.debit), 0);
              return (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.name}</td>
                  <td>{t.description || "-"}</td>
                  <td>{t.lines.length}건</td>
                  <td>{tDebit.toLocaleString()}원</td>
                  <td>
                    <div className={styles.actions}>
                      {canEdit && (
                        <button className={styles.applyBtn} onClick={() => onApply(t.id)}>
                          적용
                        </button>
                      )}
                      {canEdit && (
                        <button className={styles.editBtn} onClick={() => onEdit(t)}>
                          수정
                        </button>
                      )}
                      {canDelete && (
                        <button
                          className={styles.deleteBtn}
                          onClick={() => { if (confirm("이 템플릿을 삭제하시겠습니까?")) onDelete(t.id); }}
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className={styles.empty}>등록된 템플릿이 없습니다</p>
      )}
    </div>
  );
}

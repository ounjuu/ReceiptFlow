"use client";

import styles from "./Projects.module.css";

export interface ProjectFormProps {
  showForm: boolean;
  editingId: string | null;
  formCode: string;
  formName: string;
  formDesc: string;
  formStartDate: string;
  formEndDate: string;
  formManager: string;
  formBudget: string;
  formStatus: string;
  formError: string;
  isPending: boolean;
  canEdit: boolean;
  onFormCodeChange: (v: string) => void;
  onFormNameChange: (v: string) => void;
  onFormDescChange: (v: string) => void;
  onFormStartDateChange: (v: string) => void;
  onFormEndDateChange: (v: string) => void;
  onFormManagerChange: (v: string) => void;
  onFormBudgetChange: (v: string) => void;
  onFormStatusChange: (v: string) => void;
  onToggleForm: () => void;
  onResetForm: () => void;
  onSubmit: () => void;
}

export default function ProjectForm({
  showForm,
  editingId,
  formCode,
  formName,
  formDesc,
  formStartDate,
  formEndDate,
  formManager,
  formBudget,
  formStatus,
  formError,
  isPending,
  canEdit,
  onFormCodeChange,
  onFormNameChange,
  onFormDescChange,
  onFormStartDateChange,
  onFormEndDateChange,
  onFormManagerChange,
  onFormBudgetChange,
  onFormStatusChange,
  onToggleForm,
  onResetForm,
  onSubmit,
}: ProjectFormProps) {
  return (
    <>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>프로젝트 목록</h2>
        {canEdit && (
          <button
            className={styles.primaryBtn}
            onClick={onToggleForm}
          >
            {showForm ? "취소" : "프로젝트 등록"}
          </button>
        )}
      </div>

      {showForm && (
        <div className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>코드 *</label>
            <input
              className={styles.formInput}
              value={formCode}
              onChange={(e) => onFormCodeChange(e.target.value)}
              placeholder="PJ-001"
              readOnly={!!editingId}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>이름 *</label>
            <input
              className={styles.formInput}
              value={formName}
              onChange={(e) => onFormNameChange(e.target.value)}
              placeholder="프로젝트명"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>시작일 *</label>
            <input
              className={styles.formInput}
              type="date"
              value={formStartDate}
              onChange={(e) => onFormStartDateChange(e.target.value)}
              readOnly={!!editingId}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>종료일</label>
            <input
              className={styles.formInput}
              type="date"
              value={formEndDate}
              onChange={(e) => onFormEndDateChange(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>담당자</label>
            <input
              className={styles.formInput}
              value={formManager}
              onChange={(e) => onFormManagerChange(e.target.value)}
              placeholder="담당자명"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>예산</label>
            <input
              className={styles.formInput}
              type="number"
              value={formBudget}
              onChange={(e) => onFormBudgetChange(e.target.value)}
              placeholder="0"
            />
          </div>
          {editingId && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>상태</label>
              <select
                className={styles.formSelect}
                value={formStatus}
                onChange={(e) => onFormStatusChange(e.target.value)}
              >
                <option value="ACTIVE">진행중</option>
                <option value="COMPLETED">완료</option>
                <option value="ON_HOLD">보류</option>
              </select>
            </div>
          )}
          <div className={styles.formGroupFull}>
            <label className={styles.formLabel}>설명</label>
            <input
              className={styles.formInput}
              value={formDesc}
              onChange={(e) => onFormDescChange(e.target.value)}
              placeholder="프로젝트 설명"
            />
          </div>
          {formError && (
            <div className={styles.formGroupFull} style={{ color: "var(--danger)", fontSize: "0.85rem" }}>
              {formError}
            </div>
          )}
          <div className={styles.formActions}>
            <button className={styles.secondaryBtn} onClick={onResetForm}>
              취소
            </button>
            <button
              className={styles.primaryBtn}
              onClick={onSubmit}
              disabled={isPending}
            >
              {isPending ? "저장 중..." : editingId ? "수정" : "등록"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

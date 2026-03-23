"use client";

import styles from "./Payroll.module.css";
import { Employee, PayrollRecord, PayrollSummary, ProcessResult, fmt, now } from "./types";

/* ── 직원 목록 테이블 ── */

interface EmployeeTableProps {
  employees: Employee[];
  canEdit: boolean;
  onUpdateStatus: (id: string, dto: Record<string, unknown>) => void;
}

export function EmployeeTable({ employees, canEdit, onUpdateStatus }: EmployeeTableProps) {
  return (
    <table>
      <thead>
        <tr>
          <th>사번</th>
          <th>이름</th>
          <th>부서</th>
          <th>직급</th>
          <th>입사일</th>
          <th style={{ textAlign: "right" }}>기본급</th>
          <th>상태</th>
          {canEdit && <th>관리</th>}
        </tr>
      </thead>
      <tbody>
        {employees.map((emp) => (
          <tr key={emp.id}>
            <td>{emp.employeeNo}</td>
            <td>{emp.name}</td>
            <td>{emp.department || "-"}</td>
            <td>{emp.position || "-"}</td>
            <td>
              {new Date(emp.joinDate).toLocaleDateString("ko-KR")}
            </td>
            <td style={{ textAlign: "right" }}>
              {fmt(Number(emp.baseSalary))}원
            </td>
            <td>
              <span
                className={`${styles.badge} ${
                  emp.status === "ACTIVE"
                    ? styles.badgeActive
                    : styles.badgeInactive
                }`}
              >
                {emp.status === "ACTIVE" ? "재직" : "퇴직"}
              </span>
            </td>
            {canEdit && (
              <td>
                {emp.status === "ACTIVE" ? (
                  <button
                    className={styles.secondaryBtn}
                    style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                    onClick={() =>
                      onUpdateStatus(emp.id, {
                        status: "INACTIVE",
                        leaveDate: new Date().toISOString().slice(0, 10),
                      })
                    }
                  >
                    퇴직 처리
                  </button>
                ) : (
                  <button
                    className={styles.secondaryBtn}
                    style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                    onClick={() =>
                      onUpdateStatus(emp.id, { status: "ACTIVE" })
                    }
                  >
                    복직
                  </button>
                )}
              </td>
            )}
          </tr>
        ))}
        {employees.length === 0 && (
          <tr>
            <td
              colSpan={canEdit ? 8 : 7}
              style={{ textAlign: "center", color: "var(--text-muted)" }}
            >
              등록된 직원이 없습니다
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/* ── 급여 처리 탭 ── */

interface ProcessTabProps {
  procYear: number;
  setProcYear: (v: number) => void;
  procMonth: number;
  setProcMonth: (v: number) => void;
  onProcess: () => void;
  isPending: boolean;
  processData: ProcessResult | undefined;
}

export function ProcessTab({
  procYear,
  setProcYear,
  procMonth,
  setProcMonth,
  onProcess,
  isPending,
  processData,
}: ProcessTabProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>월별 급여 일괄 처리</h2>
      </div>
      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 16 }}>
        선택한 월의 재직 직원에 대해 급여를 계산하고 전표를 자동 생성합니다.
        이미 처리된 직원은 건너뜁니다.
      </p>
      <div className={styles.processControls}>
        <select
          className={styles.processSelect}
          value={procYear}
          onChange={(e) => setProcYear(Number(e.target.value))}
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
          className={styles.processSelect}
          value={procMonth}
          onChange={(e) => setProcMonth(Number(e.target.value))}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}월
            </option>
          ))}
        </select>
        <button
          className={styles.primaryBtn}
          onClick={onProcess}
          disabled={isPending}
        >
          {isPending ? "처리 중..." : "급여 처리 실행"}
        </button>
      </div>

      {/* 처리 결과 */}
      {processData && (
        <div style={{ marginTop: 20 }}>
          <h3 className={styles.sectionTitle}>처리 결과</h3>
          <div className={styles.summaryCards} style={{ marginTop: 12 }}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>처리 기간</div>
              <div className={styles.summaryValue}>
                {processData.period}
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>처리 건수</div>
              <div className={styles.summaryValue}>
                {processData.processedCount}명
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>총 지급액</div>
              <div className={styles.summaryValue}>
                {fmt(processData.totalGross)}원
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>총 실수령액</div>
              <div className={styles.summaryValue}>
                {fmt(processData.totalNet)}원
              </div>
            </div>
          </div>

          {processData.details.length > 0 && (
            <table style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>직원</th>
                  <th style={{ textAlign: "right" }}>총지급액</th>
                  <th style={{ textAlign: "right" }}>실수령액</th>
                </tr>
              </thead>
              <tbody>
                {processData.details.map((d) => (
                  <tr key={d.employeeId}>
                    <td>{d.employeeName}</td>
                    <td style={{ textAlign: "right" }}>{fmt(d.grossPay)}원</td>
                    <td style={{ textAlign: "right" }}>{fmt(d.netPay)}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {processData.processedCount === 0 && (
            <p style={{ marginTop: 12, color: "var(--text-muted)", fontSize: "0.9rem" }}>
              처리할 직원이 없습니다. 이미 해당 월 급여가 처리되었거나 재직
              직원이 없습니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── 급여 명세 탭 ── */

interface RecordsTabProps {
  recYear: number;
  setRecYear: (v: number) => void;
  recMonth: number;
  setRecMonth: (v: number) => void;
  records: PayrollRecord[];
  summary: PayrollSummary | undefined;
  onExport: () => void;
}

export function RecordsTab({
  recYear,
  setRecYear,
  recMonth,
  setRecMonth,
  records,
  summary,
  onExport,
}: RecordsTabProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>급여 명세</h2>
        <div className={styles.sectionHeaderRight}>
          <select
            className={styles.processSelect}
            value={recYear}
            onChange={(e) => setRecYear(Number(e.target.value))}
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
            className={styles.processSelect}
            value={recMonth}
            onChange={(e) => setRecMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
          <span className={styles.unit}>(단위: 원)</span>
          <button
            className={styles.downloadBtn}
            onClick={onExport}
            disabled={records.length === 0}
          >
            엑셀 다운로드
          </button>
        </div>
      </div>

      {/* 요약 */}
      {summary && summary.employeeCount > 0 && (
        <div className={styles.summaryCards} style={{ marginBottom: 16 }}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>인원</div>
            <div className={styles.summaryValue}>
              {summary.employeeCount}명
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>총 지급액</div>
            <div className={styles.summaryValue}>
              {fmt(summary.totalGross)}원
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>총 공제액</div>
            <div className={styles.summaryValue}>
              {fmt(summary.totalDeduction)}원
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>총 실수령액</div>
            <div className={styles.summaryValue}>
              {fmt(summary.totalNet)}원
            </div>
          </div>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>사번</th>
              <th>이름</th>
              <th>부서</th>
              <th style={{ textAlign: "right" }}>기본급</th>
              <th style={{ textAlign: "right" }}>총지급액</th>
              <th style={{ textAlign: "right" }}>국민연금</th>
              <th style={{ textAlign: "right" }}>건강보험</th>
              <th style={{ textAlign: "right" }}>장기요양</th>
              <th style={{ textAlign: "right" }}>고용보험</th>
              <th style={{ textAlign: "right" }}>소득세</th>
              <th style={{ textAlign: "right" }}>지방소득세</th>
              <th style={{ textAlign: "right" }}>총공제</th>
              <th style={{ textAlign: "right" }}>실수령액</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td>{r.employeeNo}</td>
                <td>{r.employeeName}</td>
                <td>{r.department || "-"}</td>
                <td style={{ textAlign: "right" }}>{fmt(r.baseSalary)}</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>
                  {fmt(r.grossPay)}
                </td>
                <td style={{ textAlign: "right" }} className={styles.deductionCell}>
                  {fmt(r.nationalPension)}
                </td>
                <td style={{ textAlign: "right" }} className={styles.deductionCell}>
                  {fmt(r.healthInsurance)}
                </td>
                <td style={{ textAlign: "right" }} className={styles.deductionCell}>
                  {fmt(r.longTermCare)}
                </td>
                <td style={{ textAlign: "right" }} className={styles.deductionCell}>
                  {fmt(r.employmentInsurance)}
                </td>
                <td style={{ textAlign: "right" }} className={styles.deductionCell}>
                  {fmt(r.incomeTax)}
                </td>
                <td style={{ textAlign: "right" }} className={styles.deductionCell}>
                  {fmt(r.localIncomeTax)}
                </td>
                <td style={{ textAlign: "right", color: "var(--danger)" }}>
                  {fmt(r.totalDeduction)}
                </td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>
                  {fmt(r.netPay)}
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td
                  colSpan={13}
                  style={{ textAlign: "center", color: "var(--text-muted)" }}
                >
                  해당 월 급여 내역이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

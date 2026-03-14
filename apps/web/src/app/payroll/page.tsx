"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./page.module.css";

interface Employee {
  id: string;
  employeeNo: string;
  name: string;
  department: string | null;
  position: string | null;
  joinDate: string;
  leaveDate: string | null;
  status: string;
  baseSalary: number;
}

interface PayrollRecord {
  id: string;
  employeeNo: string;
  employeeName: string;
  department: string | null;
  position: string | null;
  period: string;
  baseSalary: number;
  overtimePay: number;
  bonusPay: number;
  grossPay: number;
  nationalPension: number;
  healthInsurance: number;
  longTermCare: number;
  employmentInsurance: number;
  incomeTax: number;
  localIncomeTax: number;
  totalDeduction: number;
  netPay: number;
}

interface PayrollSummary {
  period: string;
  employeeCount: number;
  totalGross: number;
  totalDeduction: number;
  totalNet: number;
  totalPension: number;
  totalHealth: number;
  totalLongTerm: number;
  totalEmployment: number;
  totalIncomeTax: number;
  totalLocalTax: number;
}

interface ProcessResult {
  period: string;
  processedCount: number;
  totalGross: number;
  totalNet: number;
  details: { employeeId: string; employeeName: string; grossPay: number; netPay: number }[];
}

const fmt = (n: number) => n.toLocaleString();

const now = new Date();

export default function PayrollPage() {
  const { tenantId, canEdit } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"employees" | "process" | "records">("employees");
  const [showForm, setShowForm] = useState(false);

  // 직원 등록 폼
  const [formNo, setFormNo] = useState("");
  const [formName, setFormName] = useState("");
  const [formDept, setFormDept] = useState("");
  const [formPosition, setFormPosition] = useState("");
  const [formJoinDate, setFormJoinDate] = useState("");
  const [formSalary, setFormSalary] = useState("");

  // 급여 처리
  const [procYear, setProcYear] = useState(now.getFullYear());
  const [procMonth, setProcMonth] = useState(now.getMonth() + 1);

  // 급여 명세 조회
  const [recYear, setRecYear] = useState(now.getFullYear());
  const [recMonth, setRecMonth] = useState(now.getMonth() + 1);

  // 직원 목록
  const { data: employees = [] } = useQuery({
    queryKey: ["payroll-employees"],
    queryFn: () => apiGet<Employee[]>(`/payroll/employees?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  // 급여 요약
  const { data: summary } = useQuery({
    queryKey: ["payroll-summary", recYear, recMonth],
    queryFn: () =>
      apiGet<PayrollSummary>(
        `/payroll/summary?tenantId=${tenantId}&year=${recYear}&month=${recMonth}`,
      ),
    enabled: !!tenantId && tab === "records",
  });

  // 급여 현황
  const { data: records = [] } = useQuery({
    queryKey: ["payroll-records", recYear, recMonth],
    queryFn: () =>
      apiGet<PayrollRecord[]>(
        `/payroll/records?tenantId=${tenantId}&year=${recYear}&month=${recMonth}`,
      ),
    enabled: !!tenantId && tab === "records",
  });

  // 직원 등록
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPost("/payroll/employees", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-employees"] });
      resetForm();
      setShowForm(false);
    },
  });

  // 급여 처리
  const processMutation = useMutation({
    mutationFn: (data: { tenantId: string; year: number; month: number }) =>
      apiPost<ProcessResult>("/payroll/process", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-records"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-summary"] });
    },
  });

  // 직원 상태 변경
  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Record<string, unknown> }) =>
      apiPatch(`/payroll/employees/${id}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-employees"] });
    },
  });

  const resetForm = () => {
    setFormNo("");
    setFormName("");
    setFormDept("");
    setFormPosition("");
    setFormJoinDate("");
    setFormSalary("");
  };

  const handleCreate = () => {
    if (!formNo || !formName || !formJoinDate || !formSalary) return;
    createMutation.mutate({
      tenantId,
      employeeNo: formNo,
      name: formName,
      department: formDept || undefined,
      position: formPosition || undefined,
      joinDate: formJoinDate,
      baseSalary: Number(formSalary),
    });
  };

  const handleProcess = () => {
    if (!tenantId) return;
    processMutation.mutate({ tenantId, year: procYear, month: procMonth });
  };

  // 요약 카드 데이터
  const activeCount = employees.filter((e) => e.status === "ACTIVE").length;
  const totalBaseSalary = employees
    .filter((e) => e.status === "ACTIVE")
    .reduce((s, e) => s + Number(e.baseSalary), 0);

  // 엑셀 내보내기
  const exportRecords = () => {
    if (records.length === 0) return;
    exportToXlsx(
      `급여명세_${recYear}-${String(recMonth).padStart(2, "0")}`,
      "급여명세",
      [
        "사번", "이름", "부서", "직급",
        "기본급", "총지급액",
        "국민연금", "건강보험", "장기요양", "고용보험",
        "소득세", "지방소득세", "총공제액", "실수령액",
      ],
      records.map((r) => [
        r.employeeNo,
        r.employeeName,
        r.department || "",
        r.position || "",
        r.baseSalary,
        r.grossPay,
        r.nationalPension,
        r.healthInsurance,
        r.longTermCare,
        r.employmentInsurance,
        r.incomeTax,
        r.localIncomeTax,
        r.totalDeduction,
        r.netPay,
      ]),
    );
  };

  return (
    <div>
      <h1 className={styles.title}>급여 관리</h1>
      <p className={styles.subtitle}>
        직원 등록, 급여 계산, 4대보험/원천세 자동 계산 및 급여 전표를 자동
        생성합니다
      </p>

      {/* 요약 카드 */}
      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>재직 인원</div>
          <div className={styles.summaryValue}>{activeCount}명</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>총 기본급</div>
          <div className={styles.summaryValue}>{fmt(totalBaseSalary)}원</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>
            {summary ? `${summary.period} 총공제` : "총 공제"}
          </div>
          <div className={styles.summaryValue}>
            {summary ? `${fmt(summary.totalDeduction)}원` : "-"}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>
            {summary ? `${summary.period} 실수령` : "총 실수령"}
          </div>
          <div className={styles.summaryValue}>
            {summary ? `${fmt(summary.totalNet)}원` : "-"}
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "employees" ? styles.tabActive : ""}`}
          onClick={() => setTab("employees")}
        >
          직원 관리
        </button>
        <button
          className={`${styles.tab} ${tab === "process" ? styles.tabActive : ""}`}
          onClick={() => setTab("process")}
        >
          급여 처리
        </button>
        <button
          className={`${styles.tab} ${tab === "records" ? styles.tabActive : ""}`}
          onClick={() => setTab("records")}
        >
          급여 명세
        </button>
      </div>

      {/* 직원 관리 탭 */}
      {tab === "employees" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>직원 목록</h2>
            <div className={styles.sectionHeaderRight}>
              {canEdit && (
                <button
                  className={styles.primaryBtn}
                  onClick={() => setShowForm(!showForm)}
                >
                  {showForm ? "취소" : "직원 등록"}
                </button>
              )}
            </div>
          </div>

          {/* 등록 폼 */}
          {showForm && (
            <div className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>사번 *</label>
                <input
                  className={styles.formInput}
                  value={formNo}
                  onChange={(e) => setFormNo(e.target.value)}
                  placeholder="예: EMP001"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>이름 *</label>
                <input
                  className={styles.formInput}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="홍길동"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>부서</label>
                <input
                  className={styles.formInput}
                  value={formDept}
                  onChange={(e) => setFormDept(e.target.value)}
                  placeholder="경영지원팀"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>직급</label>
                <input
                  className={styles.formInput}
                  value={formPosition}
                  onChange={(e) => setFormPosition(e.target.value)}
                  placeholder="대리"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>입사일 *</label>
                <input
                  className={styles.formInput}
                  type="date"
                  value={formJoinDate}
                  onChange={(e) => setFormJoinDate(e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>월 기본급 *</label>
                <input
                  className={styles.formInput}
                  type="number"
                  value={formSalary}
                  onChange={(e) => setFormSalary(e.target.value)}
                  placeholder="3000000"
                />
              </div>
              <div className={styles.formActions}>
                <button
                  className={styles.secondaryBtn}
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
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
          )}

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
                            updateMutation.mutate({
                              id: emp.id,
                              dto: {
                                status: "INACTIVE",
                                leaveDate: new Date().toISOString().slice(0, 10),
                              },
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
                            updateMutation.mutate({
                              id: emp.id,
                              dto: { status: "ACTIVE" },
                            })
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
        </div>
      )}

      {/* 급여 처리 탭 */}
      {tab === "process" && (
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
              onClick={handleProcess}
              disabled={processMutation.isPending}
            >
              {processMutation.isPending ? "처리 중..." : "급여 처리 실행"}
            </button>
          </div>

          {/* 처리 결과 */}
          {processMutation.data && (
            <div style={{ marginTop: 20 }}>
              <h3 className={styles.sectionTitle}>처리 결과</h3>
              <div className={styles.summaryCards} style={{ marginTop: 12 }}>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>처리 기간</div>
                  <div className={styles.summaryValue}>
                    {processMutation.data.period}
                  </div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>처리 건수</div>
                  <div className={styles.summaryValue}>
                    {processMutation.data.processedCount}명
                  </div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>총 지급액</div>
                  <div className={styles.summaryValue}>
                    {fmt(processMutation.data.totalGross)}원
                  </div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>총 실수령액</div>
                  <div className={styles.summaryValue}>
                    {fmt(processMutation.data.totalNet)}원
                  </div>
                </div>
              </div>

              {processMutation.data.details.length > 0 && (
                <table style={{ marginTop: 12 }}>
                  <thead>
                    <tr>
                      <th>직원</th>
                      <th style={{ textAlign: "right" }}>총지급액</th>
                      <th style={{ textAlign: "right" }}>실수령액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processMutation.data.details.map((d) => (
                      <tr key={d.employeeId}>
                        <td>{d.employeeName}</td>
                        <td style={{ textAlign: "right" }}>{fmt(d.grossPay)}원</td>
                        <td style={{ textAlign: "right" }}>{fmt(d.netPay)}원</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {processMutation.data.processedCount === 0 && (
                <p style={{ marginTop: 12, color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  처리할 직원이 없습니다. 이미 해당 월 급여가 처리되었거나 재직
                  직원이 없습니다.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 급여 명세 탭 */}
      {tab === "records" && (
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
                onClick={exportRecords}
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
      )}
    </div>
  );
}

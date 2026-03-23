"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./Payroll.module.css";

import { Employee, PayrollRecord, PayrollSummary, ProcessResult, fmt, now } from "./types";
import PayrollForm from "./PayrollForm";
import { EmployeeTable, ProcessTab, RecordsTab } from "./PayrollTable";

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

  const handleUpdateStatus = (id: string, dto: Record<string, unknown>) => {
    updateMutation.mutate({ id, dto });
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
            <PayrollForm
              formNo={formNo}
              setFormNo={setFormNo}
              formName={formName}
              setFormName={setFormName}
              formDept={formDept}
              setFormDept={setFormDept}
              formPosition={formPosition}
              setFormPosition={setFormPosition}
              formJoinDate={formJoinDate}
              setFormJoinDate={setFormJoinDate}
              formSalary={formSalary}
              setFormSalary={setFormSalary}
              onCancel={() => {
                resetForm();
                setShowForm(false);
              }}
              onCreate={handleCreate}
              isPending={createMutation.isPending}
            />
          )}

          <EmployeeTable
            employees={employees}
            canEdit={canEdit}
            onUpdateStatus={handleUpdateStatus}
          />
        </div>
      )}

      {/* 급여 처리 탭 */}
      {tab === "process" && (
        <ProcessTab
          procYear={procYear}
          setProcYear={setProcYear}
          procMonth={procMonth}
          setProcMonth={setProcMonth}
          onProcess={handleProcess}
          isPending={processMutation.isPending}
          processData={processMutation.data}
        />
      )}

      {/* 급여 명세 탭 */}
      {tab === "records" && (
        <RecordsTab
          recYear={recYear}
          setRecYear={setRecYear}
          recMonth={recMonth}
          setRecMonth={setRecMonth}
          records={records}
          summary={summary}
          onExport={exportRecords}
        />
      )}
    </div>
  );
}

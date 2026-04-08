"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./YearEndSettlement.module.css";

interface Settlement {
  id: string;
  employeeId: string;
  employeeNo: string;
  employeeName: string;
  department: string | null;
  year: number;
  annualGrossPay: number;
  earnedIncomeDeduction: number;
  earnedIncome: number;
  personalDeduction: number;
  specialDeduction: number;
  otherDeduction: number;
  taxableIncome: number;
  calculatedTax: number;
  taxCredit: number;
  determinedTax: number;
  alreadyPaidTax: number;
  finalTax: number;
  status: "DRAFT" | "CALCULATED" | "FINALIZED";
  // 공제 입력 필드
  dependents: number;
  dependentsUnder20: number;
  dependentsOver70: number;
  insurancePremium: number;
  medicalExpense: number;
  medicalExpenseSevere: number;
  educationExpense: number;
  educationExpenseChild: number;
  donationPolitical: number;
  donationLegal: number;
  donationDesignated: number;
  creditCardUsage: number;
  debitCardUsage: number;
  cashReceiptUsage: number;
  traditionalMarket: number;
  publicTransport: number;
  housingLoanInterest: number;
  housingRent: number;
  pensionSaving: number;
}

interface SettlementSummary {
  totalEmployees: number;
  refundCount: number;
  paymentCount: number;
  totalRefund: number;
  totalPayment: number;
}

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString("ko-KR");

const now = new Date();

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "임시",
  CALCULATED: "계산완료",
  FINALIZED: "확정",
};

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "badgeDraft",
  CALCULATED: "badgeCalculated",
  FINALIZED: "badgeFinalized",
};

const DEDUCTION_FIELDS: {
  key: keyof Settlement;
  label: string;
  type: "number";
}[] = [
  { key: "dependents", label: "부양가족 수", type: "number" },
  { key: "dependentsUnder20", label: "20세 이하", type: "number" },
  { key: "dependentsOver70", label: "70세 이상", type: "number" },
  { key: "insurancePremium", label: "보험료", type: "number" },
  { key: "medicalExpense", label: "의료비", type: "number" },
  { key: "medicalExpenseSevere", label: "의료비 (중증)", type: "number" },
  { key: "educationExpense", label: "교육비", type: "number" },
  { key: "educationExpenseChild", label: "교육비 (자녀)", type: "number" },
  { key: "donationPolitical", label: "정치자금 기부금", type: "number" },
  { key: "donationLegal", label: "법정 기부금", type: "number" },
  { key: "donationDesignated", label: "지정 기부금", type: "number" },
  { key: "creditCardUsage", label: "신용카드", type: "number" },
  { key: "debitCardUsage", label: "체크카드", type: "number" },
  { key: "cashReceiptUsage", label: "현금영수증", type: "number" },
  { key: "traditionalMarket", label: "전통시장", type: "number" },
  { key: "publicTransport", label: "대중교통", type: "number" },
  { key: "housingLoanInterest", label: "주택자금 이자", type: "number" },
  { key: "housingRent", label: "월세", type: "number" },
  { key: "pensionSaving", label: "연금저축", type: "number" },
];

type DeductionKey = (typeof DEDUCTION_FIELDS)[number]["key"];

interface DeductionGroup {
  title: string;
  fields: DeductionKey[];
}

const DEDUCTION_GROUPS: DeductionGroup[] = [
  {
    title: "인적공제",
    fields: ["dependents", "dependentsUnder20", "dependentsOver70"],
  },
  { title: "보험료 공제", fields: ["insurancePremium"] },
  {
    title: "의료비 공제",
    fields: ["medicalExpense", "medicalExpenseSevere"],
  },
  {
    title: "교육비 공제",
    fields: ["educationExpense", "educationExpenseChild"],
  },
  {
    title: "기부금 공제",
    fields: ["donationPolitical", "donationLegal", "donationDesignated"],
  },
  {
    title: "신용카드 등 사용액",
    fields: [
      "creditCardUsage",
      "debitCardUsage",
      "cashReceiptUsage",
      "traditionalMarket",
      "publicTransport",
    ],
  },
  {
    title: "주택/연금",
    fields: ["housingLoanInterest", "housingRent", "pensionSaving"],
  },
];

function getFieldLabel(key: DeductionKey): string {
  return DEDUCTION_FIELDS.find((f) => f.key === key)?.label ?? key;
}

export default function YearEndSettlementPage() {
  const { tenantId, canEdit } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"overview" | "deduction" | "results">(
    "overview",
  );
  const [year, setYear] = useState(now.getFullYear());
  const [selectedId, setSelectedId] = useState<string>("");
  const [deductionForm, setDeductionForm] = useState<
    Record<string, number>
  >({});

  // 정산 현황 목록
  const { data: settlements = [] } = useQuery({
    queryKey: ["year-end-settlement", year],
    queryFn: () =>
      apiGet<Settlement[]>(
        `/year-end-settlement?tenantId=${tenantId}&year=${year}`,
      ),
    enabled: !!tenantId,
  });

  // 요약
  const { data: summary } = useQuery({
    queryKey: ["year-end-settlement-summary", year],
    queryFn: () =>
      apiGet<SettlementSummary>(
        `/year-end-settlement/summary?tenantId=${tenantId}&year=${year}`,
      ),
    enabled: !!tenantId,
  });

  // 개별 정산 상세
  const { data: detail } = useQuery({
    queryKey: ["year-end-settlement-detail", selectedId],
    queryFn: () => apiGet<Settlement>(`/year-end-settlement/${selectedId}`),
    enabled: !!selectedId,
  });

  // 일괄 생성
  const batchCreateMutation = useMutation({
    mutationFn: () =>
      apiPost("/year-end-settlement/batch-create", { tenantId, year }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["year-end-settlement", year],
      });
      queryClient.invalidateQueries({
        queryKey: ["year-end-settlement-summary", year],
      });
    },
  });

  // 공제 저장
  const saveMutation = useMutation({
    mutationFn: (data: Record<string, number>) =>
      apiPatch(`/year-end-settlement/${selectedId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["year-end-settlement", year],
      });
      queryClient.invalidateQueries({
        queryKey: ["year-end-settlement-detail", selectedId],
      });
    },
  });

  // 계산 실행
  const calculateMutation = useMutation({
    mutationFn: () =>
      apiPost(`/year-end-settlement/${selectedId}/calculate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["year-end-settlement", year],
      });
      queryClient.invalidateQueries({
        queryKey: ["year-end-settlement-summary", year],
      });
      queryClient.invalidateQueries({
        queryKey: ["year-end-settlement-detail", selectedId],
      });
    },
  });

  // 확정
  const finalizeMutation = useMutation({
    mutationFn: () =>
      apiPost(`/year-end-settlement/${selectedId}/finalize`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["year-end-settlement", year],
      });
      queryClient.invalidateQueries({
        queryKey: ["year-end-settlement-summary", year],
      });
      queryClient.invalidateQueries({
        queryKey: ["year-end-settlement-detail", selectedId],
      });
    },
  });

  // 직원 선택 시 공제 폼 초기화
  const handleSelectEmployee = (id: string) => {
    setSelectedId(id);
    const s = settlements.find((s) => s.id === id);
    if (s) {
      const form: Record<string, number> = {};
      DEDUCTION_FIELDS.forEach((f) => {
        form[f.key] = Number(s[f.key]) || 0;
      });
      setDeductionForm(form);
    }
  };

  const handleDeductionChange = (key: string, value: string) => {
    setDeductionForm((prev) => ({
      ...prev,
      [key]: value === "" ? 0 : Number(value),
    }));
  };

  const handleSaveDeductions = () => {
    if (!selectedId) return;
    saveMutation.mutate(deductionForm);
  };

  const handleCalculate = () => {
    if (!selectedId) return;
    calculateMutation.mutate();
  };

  const handleFinalize = () => {
    if (!selectedId) return;
    finalizeMutation.mutate();
  };

  // 엑셀 내보내기
  const exportAll = () => {
    if (settlements.length === 0) return;
    exportToXlsx(
      `연말정산_${year}`,
      "연말정산",
      [
        "사번",
        "이름",
        "부서",
        "총급여",
        "결정세액",
        "기납부세액",
        "환급/납부",
        "상태",
      ],
      settlements.map((s) => [
        s.employeeNo,
        s.employeeName,
        s.department || "",
        s.annualGrossPay,
        s.determinedTax,
        s.alreadyPaidTax,
        s.finalTax,
        STATUS_LABEL[s.status] || s.status,
      ]),
    );
  };

  return (
    <div>
      <h1 className={styles.title}>연말정산</h1>
      <p className={styles.subtitle}>
        직원별 소득공제/세액공제 입력 및 연말정산 계산, 환급/납부액 확정을
        관리합니다
      </p>

      {/* 요약 카드 */}
      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>총 직원수</div>
          <div className={styles.summaryValue}>
            {summary ? `${summary.totalEmployees}명` : "-"}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>환급 대상</div>
          <div className={styles.summaryValue}>
            {summary ? `${summary.refundCount}명` : "-"}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>납부 대상</div>
          <div className={styles.summaryValue}>
            {summary ? `${summary.paymentCount}명` : "-"}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>총 환급/납부액</div>
          <div className={styles.summaryValue}>
            {summary
              ? `${fmt(summary.totalRefund - summary.totalPayment)}원`
              : "-"}
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "overview" ? styles.tabActive : ""}`}
          onClick={() => setTab("overview")}
        >
          현황
        </button>
        <button
          className={`${styles.tab} ${tab === "deduction" ? styles.tabActive : ""}`}
          onClick={() => setTab("deduction")}
        >
          공제 입력
        </button>
        <button
          className={`${styles.tab} ${tab === "results" ? styles.tabActive : ""}`}
          onClick={() => setTab("results")}
        >
          정산 결과
        </button>
      </div>

      {/* 현황 탭 */}
      {tab === "overview" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{year}년 연말정산 현황</h2>
            <div className={styles.sectionHeaderRight}>
              <select
                className={styles.processSelect}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {[
                  now.getFullYear() - 1,
                  now.getFullYear(),
                  now.getFullYear() + 1,
                ].map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
              {canEdit && (
                <button
                  className={styles.primaryBtn}
                  onClick={() => batchCreateMutation.mutate()}
                  disabled={batchCreateMutation.isPending}
                >
                  {batchCreateMutation.isPending
                    ? "생성 중..."
                    : "일괄 생성"}
                </button>
              )}
              <button
                className={styles.downloadBtn}
                onClick={exportAll}
                disabled={settlements.length === 0}
              >
                엑셀 다운로드
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>사번</th>
                  <th>이름</th>
                  <th>부서</th>
                  <th style={{ textAlign: "right" }}>총급여</th>
                  <th style={{ textAlign: "right" }}>결정세액</th>
                  <th style={{ textAlign: "right" }}>기납부세액</th>
                  <th style={{ textAlign: "right" }}>환급/납부</th>
                  <th>상태</th>
                  {canEdit && <th>관리</th>}
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => (
                  <tr key={s.id}>
                    <td>{s.employeeNo}</td>
                    <td>{s.employeeName}</td>
                    <td>{s.department || "-"}</td>
                    <td style={{ textAlign: "right" }}>
                      {fmt(s.annualGrossPay)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {fmt(s.determinedTax)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {fmt(s.alreadyPaidTax)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 700,
                        color:
                          s.finalTax < 0
                            ? "#16a34a"
                            : s.finalTax > 0
                              ? "#dc2626"
                              : "var(--text)",
                      }}
                    >
                      {s.finalTax < 0
                        ? `${fmt(Math.abs(s.finalTax))} 환급`
                        : s.finalTax > 0
                          ? `${fmt(s.finalTax)} 납부`
                          : "0"}
                    </td>
                    <td>
                      <span
                        className={`${styles.badge} ${styles[STATUS_STYLE[s.status]] || ""}`}
                      >
                        {STATUS_LABEL[s.status] || s.status}
                      </span>
                    </td>
                    {canEdit && (
                      <td>
                        <button
                          className={styles.secondaryBtn}
                          style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                          onClick={() => {
                            handleSelectEmployee(s.id);
                            setTab("deduction");
                          }}
                        >
                          공제 입력
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {settlements.length === 0 && (
                  <tr>
                    <td
                      colSpan={canEdit ? 9 : 8}
                      style={{
                        textAlign: "center",
                        color: "var(--text-muted)",
                      }}
                    >
                      연말정산 데이터가 없습니다. &quot;일괄 생성&quot;을 클릭하여
                      생성하세요.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 공제 입력 탭 */}
      {tab === "deduction" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>공제 항목 입력</h2>
          </div>

          <div className={styles.employeeSelector}>
            <label>직원 선택</label>
            <select
              value={selectedId}
              onChange={(e) => handleSelectEmployee(e.target.value)}
            >
              <option value="">-- 직원을 선택하세요 --</option>
              {settlements.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.employeeNo} - {s.employeeName}
                  {s.department ? ` (${s.department})` : ""}
                </option>
              ))}
            </select>
          </div>

          {selectedId && (
            <>
              {DEDUCTION_GROUPS.map((group) => (
                <div key={group.title} className={styles.deductionGroup}>
                  <div className={styles.deductionGroupTitle}>
                    {group.title}
                  </div>
                  <div className={styles.form}>
                    {group.fields.map((fieldKey) => (
                      <div key={fieldKey} className={styles.formGroup}>
                        <label className={styles.formLabel}>
                          {getFieldLabel(fieldKey)}
                        </label>
                        <input
                          className={styles.formInput}
                          type="number"
                          value={deductionForm[fieldKey] ?? 0}
                          onChange={(e) =>
                            handleDeductionChange(fieldKey, e.target.value)
                          }
                          min={0}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className={styles.formActions}>
                <button
                  className={styles.secondaryBtn}
                  onClick={handleSaveDeductions}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? "저장 중..." : "저장"}
                </button>
                <button
                  className={styles.primaryBtn}
                  onClick={handleCalculate}
                  disabled={calculateMutation.isPending}
                >
                  {calculateMutation.isPending
                    ? "계산 중..."
                    : "계산 실행"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 정산 결과 탭 */}
      {tab === "results" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>정산 결과</h2>
            <div className={styles.sectionHeaderRight}>
              <button
                className={styles.downloadBtn}
                onClick={exportAll}
                disabled={settlements.length === 0}
              >
                엑셀 다운로드
              </button>
            </div>
          </div>

          <div className={styles.employeeSelector}>
            <label>직원 선택</label>
            <select
              value={selectedId}
              onChange={(e) => handleSelectEmployee(e.target.value)}
            >
              <option value="">-- 직원을 선택하세요 --</option>
              {settlements.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.employeeNo} - {s.employeeName}
                  {s.department ? ` (${s.department})` : ""}
                </option>
              ))}
            </select>
          </div>

          {selectedId && detail && (
            <>
              <div className={styles.waterfall}>
                <div className={styles.waterfallRow}>
                  <span className={styles.waterfallLabel}>
                    1. 총급여
                  </span>
                  <span className={styles.waterfallValue}>
                    {fmt(detail.annualGrossPay)}원
                  </span>
                </div>
                <div className={styles.waterfallRow}>
                  <span className={styles.waterfallLabel}>
                    <span className={styles.waterfallMinus}>(-)</span>{" "}
                    근로소득공제
                  </span>
                  <span className={styles.waterfallValue}>
                    {fmt(detail.earnedIncomeDeduction)}원
                  </span>
                </div>
                <div className={styles.waterfallRowResult}>
                  <span className={styles.waterfallLabel}>
                    = 근로소득금액
                  </span>
                  <span className={styles.waterfallValue}>
                    {fmt(detail.earnedIncome)}원
                  </span>
                </div>

                <div className={styles.waterfallRow}>
                  <span className={styles.waterfallLabel}>
                    <span className={styles.waterfallMinus}>(-)</span>{" "}
                    인적공제
                  </span>
                  <span className={styles.waterfallValue}>
                    {fmt(detail.personalDeduction)}원
                  </span>
                </div>
                <div className={styles.waterfallRow}>
                  <span className={styles.waterfallLabel}>
                    <span className={styles.waterfallMinus}>(-)</span>{" "}
                    특별소득공제
                  </span>
                  <span className={styles.waterfallValue}>
                    {fmt(detail.specialDeduction)}원
                  </span>
                </div>
                <div className={styles.waterfallRow}>
                  <span className={styles.waterfallLabel}>
                    <span className={styles.waterfallMinus}>(-)</span> 그 외
                    소득공제
                  </span>
                  <span className={styles.waterfallValue}>
                    {fmt(detail.otherDeduction)}원
                  </span>
                </div>
                <div className={styles.waterfallRowResult}>
                  <span className={styles.waterfallLabel}>
                    = 과세표준
                  </span>
                  <span className={styles.waterfallValue}>
                    {fmt(detail.taxableIncome)}원
                  </span>
                </div>

                <div className={styles.waterfallRow}>
                  <span className={styles.waterfallLabel}>
                    산출세액
                  </span>
                  <span className={styles.waterfallValue}>
                    {fmt(detail.calculatedTax)}원
                  </span>
                </div>
                <div className={styles.waterfallRow}>
                  <span className={styles.waterfallLabel}>
                    <span className={styles.waterfallMinus}>(-)</span>{" "}
                    세액공제
                  </span>
                  <span className={styles.waterfallValue}>
                    {fmt(detail.taxCredit)}원
                  </span>
                </div>
                <div className={styles.waterfallRowResult}>
                  <span className={styles.waterfallLabel}>
                    = 결정세액
                  </span>
                  <span className={styles.waterfallValue}>
                    {fmt(detail.determinedTax)}원
                  </span>
                </div>

                <div className={styles.waterfallRow}>
                  <span className={styles.waterfallLabel}>
                    <span className={styles.waterfallMinus}>(-)</span>{" "}
                    기납부세액
                  </span>
                  <span className={styles.waterfallValue}>
                    {fmt(detail.alreadyPaidTax)}원
                  </span>
                </div>
                <div className={styles.waterfallRowFinal}>
                  <span className={styles.waterfallLabel}>
                    = 차감납부/환급세액
                  </span>
                  <span
                    className={`${styles.waterfallValue} ${
                      detail.finalTax < 0
                        ? styles.refund
                        : detail.finalTax > 0
                          ? styles.payment
                          : ""
                    }`}
                  >
                    {detail.finalTax < 0
                      ? `${fmt(Math.abs(detail.finalTax))}원 환급`
                      : detail.finalTax > 0
                        ? `${fmt(detail.finalTax)}원 납부`
                        : "0원"}
                  </span>
                </div>
              </div>

              {/* 확정 버튼 */}
              {canEdit && detail.status === "CALCULATED" && (
                <div style={{ marginTop: 20 }}>
                  <button
                    className={styles.primaryBtn}
                    onClick={handleFinalize}
                    disabled={finalizeMutation.isPending}
                  >
                    {finalizeMutation.isPending ? "확정 중..." : "확정"}
                  </button>
                </div>
              )}

              {detail.status === "FINALIZED" && (
                <div
                  style={{
                    marginTop: 20,
                    padding: "10px 16px",
                    background: "#dcfce7",
                    borderRadius: "var(--radius)",
                    color: "#166534",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                  }}
                >
                  이 정산은 확정되었습니다.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

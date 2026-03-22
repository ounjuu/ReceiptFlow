"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete, API_BASE } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import styles from "./TaxFiling.module.css";

// 타입 정의
interface FilingSummary {
  vatCount: number;
  withholdingCount: number;
  corporateCount: number;
  totalTaxAmount: number;
}

interface Filing {
  id: string;
  filingType: "VAT" | "WITHHOLDING" | "CORPORATE";
  year: number;
  quarter: number | null;
  month: number | null;
  taxBase: number;
  taxAmount: number;
  status: "DRAFT" | "GENERATED" | "EXPORTED" | "FILED" | "ACCEPTED" | "REJECTED";
  filingReference: string | null;
  filingData: Record<string, unknown>;
  createdAt: string;
}

type TabType = "overview" | "vat" | "withholding" | "corporate";

const fmt = (n: number) => n.toLocaleString("ko-KR");

const now = new Date();

// 상태 라벨/스타일 매핑
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "임시",
  GENERATED: "생성됨",
  EXPORTED: "내보냄",
  FILED: "신고됨",
  ACCEPTED: "접수완료",
  REJECTED: "반려",
};

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "badgeDraft",
  GENERATED: "badgeGenerated",
  EXPORTED: "badgeExported",
  FILED: "badgeFiled",
  ACCEPTED: "badgeAccepted",
  REJECTED: "badgeRejected",
};

const TYPE_LABEL: Record<string, string> = {
  VAT: "부가세",
  WITHHOLDING: "원천세",
  CORPORATE: "법인세",
};

const TYPE_STYLE: Record<string, string> = {
  VAT: "typeVat",
  WITHHOLDING: "typeWithholding",
  CORPORATE: "typeCorporate",
};

// 상태 타임라인 순서
const STATUS_STEPS = ["DRAFT", "GENERATED", "EXPORTED", "FILED", "ACCEPTED"];

/** 인증 헤더 포함 파일 다운로드 */
async function downloadFile(url: string, filename: string) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}${url}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("다운로드 실패");
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function TaxFilingPage() {
  const { tenantId, canEdit } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<TabType>("overview");
  const [year, setYear] = useState(now.getFullYear());

  // 부가세 탭 상태
  const [vatQuarter, setVatQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));

  // 원천세 탭 상태
  const [whMonth, setWhMonth] = useState(now.getMonth() + 1);

  // 상태 업데이트 폼
  const [statusForm, setStatusForm] = useState<{
    id: string;
    status: string;
    filingReference: string;
  } | null>(null);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  // === 공통 쿼리 ===

  // 연간 요약
  const { data: summary } = useQuery({
    queryKey: ["tax-filing-summary", year],
    queryFn: () =>
      apiGet<FilingSummary>(
        `/tax-filing/summary?tenantId=${tenantId}&year=${year}`,
      ),
    enabled: !!tenantId,
  });

  // 연간 전체 목록
  const { data: filings = [] } = useQuery({
    queryKey: ["tax-filing", year],
    queryFn: () =>
      apiGet<Filing[]>(`/tax-filing?tenantId=${tenantId}&year=${year}`),
    enabled: !!tenantId,
  });

  // 부가세 해당 분기 조회
  const { data: vatFilings = [] } = useQuery({
    queryKey: ["tax-filing", "vat", year, vatQuarter],
    queryFn: () =>
      apiGet<Filing[]>(
        `/tax-filing?tenantId=${tenantId}&year=${year}&filingType=VAT&quarter=${vatQuarter}`,
      ),
    enabled: !!tenantId && tab === "vat",
  });
  const vatFiling = vatFilings.length > 0 ? vatFilings[0] : null;

  // 원천세 해당 월 조회
  const { data: whFilings = [] } = useQuery({
    queryKey: ["tax-filing", "withholding", year, whMonth],
    queryFn: () =>
      apiGet<Filing[]>(
        `/tax-filing?tenantId=${tenantId}&year=${year}&filingType=WITHHOLDING&month=${whMonth}`,
      ),
    enabled: !!tenantId && tab === "withholding",
  });
  const whFiling = whFilings.length > 0 ? whFilings[0] : null;

  // 법인세 조회
  const { data: corpFilings = [] } = useQuery({
    queryKey: ["tax-filing", "corporate", year],
    queryFn: () =>
      apiGet<Filing[]>(
        `/tax-filing?tenantId=${tenantId}&year=${year}&filingType=CORPORATE`,
      ),
    enabled: !!tenantId && tab === "corporate",
  });
  const corpFiling = corpFilings.length > 0 ? corpFilings[0] : null;

  // === Mutations ===

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["tax-filing"] });
    queryClient.invalidateQueries({ queryKey: ["tax-filing-summary"] });
  };

  // 부가세 생성
  const vatGenerateMutation = useMutation({
    mutationFn: () =>
      apiPost("/tax-filing/vat/generate", { tenantId, year, quarter: vatQuarter }),
    onSuccess: invalidateAll,
  });

  // 원천세 생성
  const whGenerateMutation = useMutation({
    mutationFn: () =>
      apiPost("/tax-filing/withholding/generate", { tenantId, year, month: whMonth }),
    onSuccess: invalidateAll,
  });

  // 법인세 생성
  const corpGenerateMutation = useMutation({
    mutationFn: () =>
      apiPost("/tax-filing/corporate/generate", { tenantId, year }),
    onSuccess: invalidateAll,
  });

  // 상태 업데이트
  const statusMutation = useMutation({
    mutationFn: ({ id, status, filingReference }: { id: string; status: string; filingReference: string }) =>
      apiPatch(`/tax-filing/${id}/status`, { status, filingReference: filingReference || undefined }),
    onSuccess: () => {
      invalidateAll();
      setStatusForm(null);
    },
  });

  // 삭제
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/tax-filing/${id}`),
    onSuccess: invalidateAll,
  });

  const handleDelete = (id: string) => {
    if (confirm("이 신고 데이터를 삭제하시겠습니까?")) {
      deleteMutation.mutate(id);
    }
  };

  // 내보내기 핸들러
  const handleExport = (id: string, format: "csv" | "xml", filingType: string) => {
    const filename = `${TYPE_LABEL[filingType] || filingType}_${year}.${format}`;
    downloadFile(`/tax-filing/${id}/export?format=${format}`, filename);
  };

  // 상태 타임라인 렌더링
  const renderTimeline = (status: string) => {
    const currentIdx = STATUS_STEPS.indexOf(status);
    const isRejected = status === "REJECTED";

    return (
      <div className={styles.timeline}>
        {STATUS_STEPS.map((step, i) => {
          const isDone = i < currentIdx;
          const isActive = i === currentIdx && !isRejected;
          return (
            <div key={step} style={{ display: "flex", alignItems: "center" }}>
              <div className={`${styles.timelineStep} ${isActive ? styles.timelineStepActive : ""}`}>
                <span
                  className={`${styles.timelineDot} ${isDone ? styles.timelineDotDone : ""} ${isActive ? styles.timelineDotActive : ""}`}
                />
                {STATUS_LABEL[step]}
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <span className={`${styles.timelineLine} ${isDone ? styles.timelineLineDone : ""}`} />
              )}
            </div>
          );
        })}
        {isRejected && (
          <div className={styles.timelineStep}>
            <span className={styles.timelineDot} style={{ background: "#dc2626" }} />
            <span style={{ color: "#dc2626", fontWeight: 600 }}>반려</span>
          </div>
        )}
      </div>
    );
  };

  // 상태 변경 폼 렌더링
  const renderStatusForm = (filing: Filing) => {
    const isEditing = statusForm?.id === filing.id;

    if (!canEdit) return null;

    if (!isEditing) {
      return (
        <button
          className={styles.secondaryBtn}
          style={{ fontSize: "0.8rem", marginTop: 12 }}
          onClick={() =>
            setStatusForm({
              id: filing.id,
              status: filing.status,
              filingReference: filing.filingReference || "",
            })
          }
        >
          상태 변경
        </button>
      );
    }

    return (
      <div className={styles.statusForm}>
        <span className={styles.statusFormLabel}>상태</span>
        <select
          className={styles.statusFormSelect}
          value={statusForm.status}
          onChange={(e) =>
            setStatusForm({ ...statusForm, status: e.target.value })
          }
        >
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <span className={styles.statusFormLabel}>접수번호</span>
        <input
          className={styles.statusFormInput}
          type="text"
          value={statusForm.filingReference}
          onChange={(e) =>
            setStatusForm({ ...statusForm, filingReference: e.target.value })
          }
          placeholder="선택 입력"
        />
        <button
          className={styles.primaryBtn}
          onClick={() => statusMutation.mutate(statusForm)}
          disabled={statusMutation.isPending}
        >
          {statusMutation.isPending ? "저장 중..." : "저장"}
        </button>
        <button
          className={styles.secondaryBtn}
          onClick={() => setStatusForm(null)}
        >
          취소
        </button>
      </div>
    );
  };

  // 내보내기 버튼 그룹 렌더링
  const renderExportButtons = (filing: Filing) => (
    <div className={styles.exportGroup}>
      <button
        className={styles.downloadBtn}
        onClick={() => handleExport(filing.id, "csv", filing.filingType)}
      >
        CSV 내보내기
      </button>
      <button
        className={styles.downloadBtn}
        onClick={() => handleExport(filing.id, "xml", filing.filingType)}
      >
        XML 내보내기
      </button>
    </div>
  );

  return (
    <div>
      <h1 className={styles.title}>전자신고</h1>
      <p className={styles.subtitle}>
        부가세, 원천세, 법인세 신고 데이터를 생성하고 관리합니다
      </p>

      {/* 요약 카드 */}
      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>부가세</div>
          <div className={styles.summaryValue}>
            {summary ? `${summary.vatCount}건` : "-"}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>원천세</div>
          <div className={styles.summaryValue}>
            {summary ? `${summary.withholdingCount}건` : "-"}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>법인세</div>
          <div className={styles.summaryValue}>
            {summary ? `${summary.corporateCount}건` : "-"}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>총 납부세액</div>
          <div className={styles.summaryValue}>
            {summary ? `${fmt(summary.totalTaxAmount)}원` : "-"}
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "overview" ? styles.tabActive : ""}`}
          onClick={() => setTab("overview")}
        >
          신고 현황
        </button>
        <button
          className={`${styles.tab} ${tab === "vat" ? styles.tabActive : ""}`}
          onClick={() => setTab("vat")}
        >
          부가세 신고
        </button>
        <button
          className={`${styles.tab} ${tab === "withholding" ? styles.tabActive : ""}`}
          onClick={() => setTab("withholding")}
        >
          원천세 신고
        </button>
        <button
          className={`${styles.tab} ${tab === "corporate" ? styles.tabActive : ""}`}
          onClick={() => setTab("corporate")}
        >
          법인세 신고
        </button>
      </div>

      {/* ===== 탭 1: 신고 현황 ===== */}
      {tab === "overview" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{year}년 신고 현황</h2>
            <div className={styles.sectionHeaderRight}>
              <select
                className={styles.processSelect}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>유형</th>
                  <th>기간</th>
                  <th style={{ textAlign: "right" }}>과세표준</th>
                  <th style={{ textAlign: "right" }}>세액</th>
                  <th>상태</th>
                  <th>접수번호</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {filings.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <span className={`${styles.badge} ${styles[TYPE_STYLE[f.filingType]] || ""}`}>
                        {TYPE_LABEL[f.filingType] || f.filingType}
                      </span>
                    </td>
                    <td>
                      {f.filingType === "VAT" && f.quarter
                        ? `${f.year}년 ${f.quarter}분기`
                        : f.filingType === "WITHHOLDING" && f.month
                          ? `${f.year}년 ${f.month}월`
                          : `${f.year}년`}
                    </td>
                    <td style={{ textAlign: "right" }}>{fmt(f.taxBase)}원</td>
                    <td style={{ textAlign: "right" }}>{fmt(f.taxAmount)}원</td>
                    <td>
                      <span className={`${styles.badge} ${styles[STATUS_STYLE[f.status]] || ""}`}>
                        {STATUS_LABEL[f.status] || f.status}
                      </span>
                    </td>
                    <td>{f.filingReference || "-"}</td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          className={styles.actionBtn}
                          onClick={() => {
                            // 상세보기: 해당 탭으로 이동
                            if (f.filingType === "VAT") {
                              setVatQuarter(f.quarter || 1);
                              setTab("vat");
                            } else if (f.filingType === "WITHHOLDING") {
                              setWhMonth(f.month || 1);
                              setTab("withholding");
                            } else {
                              setTab("corporate");
                            }
                          }}
                        >
                          상세보기
                        </button>
                        <button
                          className={styles.actionBtn}
                          onClick={() => handleExport(f.id, "csv", f.filingType)}
                        >
                          내보내기
                        </button>
                        {f.status === "DRAFT" && canEdit && (
                          <button
                            className={styles.deleteActionBtn}
                            onClick={() => handleDelete(f.id)}
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filings.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{ textAlign: "center", color: "var(--text-muted)" }}
                    >
                      신고 데이터가 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== 탭 2: 부가세 신고 ===== */}
      {tab === "vat" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>부가세 신고</h2>
          </div>

          <div className={styles.processControls}>
            <select
              className={styles.processSelect}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
            <select
              className={styles.processSelect}
              value={vatQuarter}
              onChange={(e) => setVatQuarter(Number(e.target.value))}
            >
              <option value={1}>1분기 (1~3월)</option>
              <option value={2}>2분기 (4~6월)</option>
              <option value={3}>3분기 (7~9월)</option>
              <option value={4}>4분기 (10~12월)</option>
            </select>
            {canEdit && (
              <button
                className={styles.primaryBtn}
                onClick={() => vatGenerateMutation.mutate()}
                disabled={vatGenerateMutation.isPending}
              >
                {vatGenerateMutation.isPending ? "생성 중..." : "데이터 생성"}
              </button>
            )}
          </div>

          {vatFiling ? (
            <>
              {/* 상태 타임라인 */}
              {renderTimeline(vatFiling.status)}

              {/* 매출/매입 요약 */}
              <div className={styles.dataGrid}>
                <div className={styles.dataCard}>
                  <div className={styles.dataCardTitle}>매출 세금계산서</div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>건수</span>
                    <span className={styles.dataValue}>
                      {fmt((vatFiling.filingData?.salesCount as number) || 0)}건
                    </span>
                  </div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>공급가액</span>
                    <span className={styles.dataValue}>
                      {fmt((vatFiling.filingData?.salesSupplyAmount as number) || 0)}원
                    </span>
                  </div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>세액</span>
                    <span className={styles.dataValue}>
                      {fmt((vatFiling.filingData?.salesTaxAmount as number) || 0)}원
                    </span>
                  </div>
                </div>
                <div className={styles.dataCard}>
                  <div className={styles.dataCardTitle}>매입 세금계산서</div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>건수</span>
                    <span className={styles.dataValue}>
                      {fmt((vatFiling.filingData?.purchaseCount as number) || 0)}건
                    </span>
                  </div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>공급가액</span>
                    <span className={styles.dataValue}>
                      {fmt((vatFiling.filingData?.purchaseSupplyAmount as number) || 0)}원
                    </span>
                  </div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>세액</span>
                    <span className={styles.dataValue}>
                      {fmt((vatFiling.filingData?.purchaseTaxAmount as number) || 0)}원
                    </span>
                  </div>
                </div>
              </div>

              {/* 차감납부세액 */}
              <div className={styles.dataCard} style={{ marginBottom: 16 }}>
                <div className={styles.dataRow}>
                  <span className={styles.dataLabel}>차감납부세액</span>
                  <span className={styles.dataValueHighlight}>
                    {fmt(vatFiling.taxAmount)}원
                  </span>
                </div>
              </div>

              {/* 거래처별 매출 명세 */}
              {Array.isArray(vatFiling.filingData?.salesList) &&
                (vatFiling.filingData.salesList as Record<string, unknown>[]).length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <h3 className={styles.sectionTitle}>거래처별 매출 명세</h3>
                    <div style={{ overflowX: "auto" }}>
                      <table>
                        <thead>
                          <tr>
                            <th>거래처</th>
                            <th>사업자번호</th>
                            <th style={{ textAlign: "right" }}>공급가액</th>
                            <th style={{ textAlign: "right" }}>세액</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(vatFiling.filingData.salesList as Record<string, unknown>[]).map(
                            (item, i) => (
                              <tr key={i}>
                                <td>{String(item.name || "")}</td>
                                <td>{String(item.bizNo || "")}</td>
                                <td style={{ textAlign: "right" }}>
                                  {fmt(Number(item.supplyAmount) || 0)}원
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  {fmt(Number(item.taxAmount) || 0)}원
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              {/* 거래처별 매입 명세 */}
              {Array.isArray(vatFiling.filingData?.purchaseList) &&
                (vatFiling.filingData.purchaseList as Record<string, unknown>[]).length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <h3 className={styles.sectionTitle}>거래처별 매입 명세</h3>
                    <div style={{ overflowX: "auto" }}>
                      <table>
                        <thead>
                          <tr>
                            <th>거래처</th>
                            <th>사업자번호</th>
                            <th style={{ textAlign: "right" }}>공급가액</th>
                            <th style={{ textAlign: "right" }}>세액</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(vatFiling.filingData.purchaseList as Record<string, unknown>[]).map(
                            (item, i) => (
                              <tr key={i}>
                                <td>{String(item.name || "")}</td>
                                <td>{String(item.bizNo || "")}</td>
                                <td style={{ textAlign: "right" }}>
                                  {fmt(Number(item.supplyAmount) || 0)}원
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  {fmt(Number(item.taxAmount) || 0)}원
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              {/* 내보내기 버튼 */}
              {renderExportButtons(vatFiling)}

              {/* 상태 변경 */}
              {renderStatusForm(vatFiling)}
            </>
          ) : (
            <div className={styles.emptyState}>
              해당 기간의 부가세 신고 데이터가 없습니다.
              <br />
              &quot;데이터 생성&quot; 버튼을 클릭하여 신고 데이터를 생성하세요.
            </div>
          )}
        </div>
      )}

      {/* ===== 탭 3: 원천세 신고 ===== */}
      {tab === "withholding" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>원천세 신고</h2>
          </div>

          <div className={styles.processControls}>
            <select
              className={styles.processSelect}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
            <select
              className={styles.processSelect}
              value={whMonth}
              onChange={(e) => setWhMonth(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>
            {canEdit && (
              <button
                className={styles.primaryBtn}
                onClick={() => whGenerateMutation.mutate()}
                disabled={whGenerateMutation.isPending}
              >
                {whGenerateMutation.isPending ? "생성 중..." : "데이터 생성"}
              </button>
            )}
          </div>

          {whFiling ? (
            <>
              {renderTimeline(whFiling.status)}

              {/* 요약 */}
              <div className={styles.dataGrid}>
                <div className={styles.dataCard}>
                  <div className={styles.dataCardTitle}>급여 요약</div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>인원</span>
                    <span className={styles.dataValue}>
                      {fmt((whFiling.filingData?.employeeCount as number) || 0)}명
                    </span>
                  </div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>총지급액</span>
                    <span className={styles.dataValue}>
                      {fmt((whFiling.filingData?.totalGrossPay as number) || 0)}원
                    </span>
                  </div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>소득세</span>
                    <span className={styles.dataValue}>
                      {fmt((whFiling.filingData?.incomeTax as number) || 0)}원
                    </span>
                  </div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>지방소득세</span>
                    <span className={styles.dataValue}>
                      {fmt((whFiling.filingData?.localIncomeTax as number) || 0)}원
                    </span>
                  </div>
                </div>
                <div className={styles.dataCard}>
                  <div className={styles.dataCardTitle}>사업주 부담 보험료</div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>국민연금</span>
                    <span className={styles.dataValue}>
                      {fmt((whFiling.filingData?.nationalPension as number) || 0)}원
                    </span>
                  </div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>건강보험</span>
                    <span className={styles.dataValue}>
                      {fmt((whFiling.filingData?.healthInsurance as number) || 0)}원
                    </span>
                  </div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>고용보험</span>
                    <span className={styles.dataValue}>
                      {fmt((whFiling.filingData?.employmentInsurance as number) || 0)}원
                    </span>
                  </div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>산재보험</span>
                    <span className={styles.dataValue}>
                      {fmt((whFiling.filingData?.industrialAccident as number) || 0)}원
                    </span>
                  </div>
                </div>
              </div>

              {/* 직원별 명세 */}
              {Array.isArray(whFiling.filingData?.details) &&
                (whFiling.filingData.details as Record<string, unknown>[]).length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <h3 className={styles.sectionTitle}>직원별 명세</h3>
                    <div style={{ overflowX: "auto" }}>
                      <table>
                        <thead>
                          <tr>
                            <th>사번</th>
                            <th>이름</th>
                            <th style={{ textAlign: "right" }}>지급액</th>
                            <th style={{ textAlign: "right" }}>소득세</th>
                            <th style={{ textAlign: "right" }}>지방소득세</th>
                            <th style={{ textAlign: "right" }}>4대보험</th>
                            <th style={{ textAlign: "right" }}>실수령액</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(whFiling.filingData.details as Record<string, unknown>[]).map(
                            (d, i) => (
                              <tr key={i}>
                                <td>{String(d.employeeNo || "")}</td>
                                <td>{String(d.employeeName || "")}</td>
                                <td style={{ textAlign: "right" }}>
                                  {fmt(Number(d.grossPay) || 0)}원
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  {fmt(Number(d.incomeTax) || 0)}원
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  {fmt(Number(d.localIncomeTax) || 0)}원
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  {fmt(Number(d.socialInsurance) || 0)}원
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  {fmt(Number(d.netPay) || 0)}원
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              {renderExportButtons(whFiling)}
              {renderStatusForm(whFiling)}
            </>
          ) : (
            <div className={styles.emptyState}>
              해당 기간의 원천세 신고 데이터가 없습니다.
              <br />
              &quot;데이터 생성&quot; 버튼을 클릭하여 신고 데이터를 생성하세요.
            </div>
          )}
        </div>
      )}

      {/* ===== 탭 4: 법인세 신고 ===== */}
      {tab === "corporate" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>법인세 신고</h2>
          </div>

          <div className={styles.processControls}>
            <select
              className={styles.processSelect}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
            {canEdit && (
              <button
                className={styles.primaryBtn}
                onClick={() => corpGenerateMutation.mutate()}
                disabled={corpGenerateMutation.isPending}
              >
                {corpGenerateMutation.isPending ? "생성 중..." : "데이터 생성"}
              </button>
            )}
          </div>

          {corpFiling ? (
            <>
              {renderTimeline(corpFiling.status)}

              {/* 손익 요약 */}
              <div className={styles.dataGrid}>
                <div className={styles.dataCard}>
                  <div className={styles.dataCardTitle}>손익 요약</div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>매출액</span>
                    <span className={styles.dataValue}>
                      {fmt((corpFiling.filingData?.revenue as number) || 0)}원
                    </span>
                  </div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>비용</span>
                    <span className={styles.dataValue}>
                      {fmt((corpFiling.filingData?.expenses as number) || 0)}원
                    </span>
                  </div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>영업이익</span>
                    <span className={styles.dataValue}>
                      {fmt((corpFiling.filingData?.operatingIncome as number) || 0)}원
                    </span>
                  </div>
                </div>
                <div className={styles.dataCard}>
                  <div className={styles.dataCardTitle}>세액 계산</div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>과세표준</span>
                    <span className={styles.dataValue}>
                      {fmt(corpFiling.taxBase)}원
                    </span>
                  </div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>산출세액</span>
                    <span className={styles.dataValue}>
                      {fmt((corpFiling.filingData?.calculatedTax as number) || 0)}원
                    </span>
                  </div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>결정세액</span>
                    <span className={styles.dataValueHighlight}>
                      {fmt(corpFiling.taxAmount)}원
                    </span>
                  </div>
                </div>
              </div>

              {/* 세율 구간 */}
              {Array.isArray(corpFiling.filingData?.taxBrackets) &&
                (corpFiling.filingData.taxBrackets as Record<string, unknown>[]).length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <h3 className={styles.sectionTitle}>세율 구간</h3>
                    <div style={{ overflowX: "auto" }}>
                      <table>
                        <thead>
                          <tr>
                            <th>구간</th>
                            <th style={{ textAlign: "right" }}>세율</th>
                            <th style={{ textAlign: "right" }}>과세표준</th>
                            <th style={{ textAlign: "right" }}>세액</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(corpFiling.filingData.taxBrackets as Record<string, unknown>[]).map(
                            (b, i) => (
                              <tr key={i}>
                                <td>{String(b.bracket || "")}</td>
                                <td style={{ textAlign: "right" }}>
                                  {Number(b.rate) || 0}%
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  {fmt(Number(b.base) || 0)}원
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  {fmt(Number(b.tax) || 0)}원
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              {renderExportButtons(corpFiling)}
              {renderStatusForm(corpFiling)}
            </>
          ) : (
            <div className={styles.emptyState}>
              해당 연도의 법인세 신고 데이터가 없습니다.
              <br />
              &quot;데이터 생성&quot; 버튼을 클릭하여 신고 데이터를 생성하세요.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

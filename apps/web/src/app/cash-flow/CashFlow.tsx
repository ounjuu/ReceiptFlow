"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./CashFlow.module.css";

type Tab = "daily" | "cashflow";

interface DayDetail {
  description: string;
  account: string;
  deposit: number;
  withdraw: number;
}

interface DailyCashDay {
  date: string;
  prevBalance: number;
  deposit: number;
  withdraw: number;
  balance: number;
  details: DayDetail[];
}

interface DailyCashReport {
  days: DailyCashDay[];
  openingBalance: number;
  closingBalance: number;
  totalDeposit: number;
  totalWithdraw: number;
}

interface CashFlowItem {
  name: string;
  amount: number;
}

interface CashFlowSection {
  items: CashFlowItem[];
  total: number;
}

interface CashFlowStatement {
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  netCashChange: number;
  openingCash: number;
  closingCash: number;
}

const fmt = (n: number) => n.toLocaleString();

const COLORS = {
  deposit: "#4caf82",
  withdraw: "#d95454",
};

export default function CashFlowPage() {
  const { tenantId } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("daily");

  // 기본 필터: 이번 달
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = now.toISOString().slice(0, 10);

  const [filterStart, setFilterStart] = useState(monthStart);
  const [filterEnd, setFilterEnd] = useState(monthEnd);

  const dateParams = [
    filterStart && `startDate=${filterStart}`,
    filterEnd && `endDate=${filterEnd}`,
  ].filter(Boolean).join("&");

  return (
    <div>
      <h1 className={styles.title}>자금 관리</h1>
      <p className={styles.subtitle}>일별 입출금 현황과 현금흐름표를 확인하세요</p>

      <div className={styles.filterRow}>
        <span className={styles.filterLabel}>기간</span>
        <input
          className={styles.filterInput}
          type="date"
          value={filterStart}
          onChange={(e) => setFilterStart(e.target.value)}
        />
        <span className={styles.filterSep}>~</span>
        <input
          className={styles.filterInput}
          type="date"
          value={filterEnd}
          onChange={(e) => setFilterEnd(e.target.value)}
        />
        {(filterStart !== monthStart || filterEnd !== monthEnd) && (
          <button
            className={styles.filterClear}
            onClick={() => { setFilterStart(monthStart); setFilterEnd(monthEnd); }}
          >
            이번 달
          </button>
        )}
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "daily" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("daily")}
        >
          자금 일보
        </button>
        <button
          className={`${styles.tab} ${activeTab === "cashflow" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("cashflow")}
        >
          현금 흐름표
        </button>
      </div>

      {activeTab === "daily" && (
        <DailyCashView tenantId={tenantId} dateParams={dateParams} />
      )}
      {activeTab === "cashflow" && (
        <CashFlowView tenantId={tenantId} dateParams={dateParams} />
      )}
    </div>
  );
}

// --- 자금 일보 ---

function DailyCashView({ tenantId, dateParams }: { tenantId: string | null; dateParams: string }) {
  const { data } = useQuery({
    queryKey: ["reports", "daily-cash", dateParams],
    queryFn: () =>
      apiGet<DailyCashReport>(`/reports/daily-cash?tenantId=${tenantId}${dateParams ? `&${dateParams}` : ""}`),
    enabled: !!tenantId,
  });

  if (!data) return <p>불러오는 중...</p>;

  const chartData = data.days.map((d) => ({
    date: d.date.slice(5), // MM-DD
    입금: d.deposit,
    출금: d.withdraw,
    잔액: d.balance,
  }));

  const handleExport = () => {
    const rows = data.days.map((d) => [
      d.date,
      d.prevBalance,
      d.deposit,
      d.withdraw,
      d.balance,
    ]);
    rows.push(["합계", data.openingBalance, data.totalDeposit, data.totalWithdraw, data.closingBalance]);
    exportToXlsx("자금일보", "자금일보", ["날짜", "전일잔액", "입금", "출금", "당일잔액"], rows as (string | number)[][]);
  };

  return (
    <>
      {/* 요약 카드 */}
      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>기초잔액</div>
          <div className={styles.summaryValue}>₩{fmt(data.openingBalance)}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>총 입금</div>
          <div className={`${styles.summaryValue} ${styles.positive}`}>
            ₩{fmt(data.totalDeposit)}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>총 출금</div>
          <div className={`${styles.summaryValue} ${styles.negative}`}>
            ₩{fmt(data.totalWithdraw)}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>기말잔액</div>
          <div className={styles.summaryValue}>₩{fmt(data.closingBalance)}</div>
        </div>
      </div>

      {/* 차트 */}
      {chartData.length > 0 && (
        <div className={styles.chartSection}>
          <h3 className={styles.chartTitle}>일별 입출금 추이</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e4f0" />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
              <Tooltip formatter={(v) => [`₩${fmt(Number(v))}`, ""]} />
              <Legend />
              <Bar dataKey="입금" fill={COLORS.deposit} radius={[4, 4, 0, 0]} />
              <Bar dataKey="출금" fill={COLORS.withdraw} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 일별 테이블 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>일별 입출금 내역</h2>
          <div className={styles.sectionHeaderRight}>
            <span className={styles.unit}>(단위: 원)</span>
            <button className={styles.downloadBtn} onClick={handleExport}>
              엑셀 다운로드
            </button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>날짜</th>
              <th style={{ textAlign: "right" }}>전일잔액</th>
              <th style={{ textAlign: "right" }}>입금</th>
              <th style={{ textAlign: "right" }}>출금</th>
              <th style={{ textAlign: "right" }}>당일잔액</th>
            </tr>
          </thead>
          <tbody>
            {data.days.map((d) => (
              <tr key={d.date}>
                <td>{d.date}</td>
                <td style={{ textAlign: "right" }}>₩{fmt(d.prevBalance)}</td>
                <td style={{ textAlign: "right", color: "var(--success)" }}>
                  {d.deposit > 0 ? `₩${fmt(d.deposit)}` : "-"}
                </td>
                <td style={{ textAlign: "right", color: "var(--danger)" }}>
                  {d.withdraw > 0 ? `₩${fmt(d.withdraw)}` : "-"}
                </td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>₩{fmt(d.balance)}</td>
              </tr>
            ))}
            {data.days.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                  해당 기간에 현금 거래가 없습니다
                </td>
              </tr>
            )}
            {data.days.length > 0 && (
              <tr className={styles.totalRow}>
                <td>합계</td>
                <td style={{ textAlign: "right" }}>₩{fmt(data.openingBalance)}</td>
                <td style={{ textAlign: "right" }}>₩{fmt(data.totalDeposit)}</td>
                <td style={{ textAlign: "right" }}>₩{fmt(data.totalWithdraw)}</td>
                <td style={{ textAlign: "right" }}>₩{fmt(data.closingBalance)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// --- 현금 흐름표 ---

function CashFlowView({ tenantId, dateParams }: { tenantId: string | null; dateParams: string }) {
  const { data } = useQuery({
    queryKey: ["reports", "cash-flow", dateParams],
    queryFn: () =>
      apiGet<CashFlowStatement>(`/reports/cash-flow?tenantId=${tenantId}${dateParams ? `&${dateParams}` : ""}`),
    enabled: !!tenantId,
  });

  if (!data) return <p>불러오는 중...</p>;

  const handleExport = () => {
    const rows: (string | number)[][] = [];
    rows.push(["영업활동으로 인한 현금흐름", ""]);
    data.operating.items.forEach((i) => rows.push([`  ${i.name}`, i.amount]));
    rows.push(["영업활동 소계", data.operating.total]);
    rows.push(["", ""]);
    rows.push(["투자활동으로 인한 현금흐름", ""]);
    data.investing.items.forEach((i) => rows.push([`  ${i.name}`, i.amount]));
    rows.push(["투자활동 소계", data.investing.total]);
    rows.push(["", ""]);
    rows.push(["재무활동으로 인한 현금흐름", ""]);
    data.financing.items.forEach((i) => rows.push([`  ${i.name}`, i.amount]));
    rows.push(["재무활동 소계", data.financing.total]);
    rows.push(["", ""]);
    rows.push(["현금 순증감", data.netCashChange]);
    rows.push(["기초 현금", data.openingCash]);
    rows.push(["기말 현금", data.closingCash]);
    exportToXlsx("현금흐름표", "현금흐름표", ["항목", "금액"], rows);
  };

  const renderSection = (
    title: string,
    section: CashFlowSection,
  ) => (
    <>
      <tr className={styles.groupHeader}>
        <td colSpan={2}>{title}</td>
      </tr>
      {section.items.map((item) => (
        <tr key={item.name}>
          <td style={{ paddingLeft: 28 }}>{item.name}</td>
          <td style={{ textAlign: "right" }} className={item.amount >= 0 ? styles.positive : styles.negative}>
            {item.amount >= 0 ? "" : "-"}₩{fmt(Math.abs(item.amount))}
          </td>
        </tr>
      ))}
      <tr className={styles.subtotalRow}>
        <td>{title.replace("으로 인한 현금흐름", "")} 소계</td>
        <td style={{ textAlign: "right" }} className={section.total >= 0 ? styles.positive : styles.negative}>
          {section.total >= 0 ? "" : "-"}₩{fmt(Math.abs(section.total))}
        </td>
      </tr>
    </>
  );

  return (
    <>
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>현금 흐름표 (간접법)</h2>
          <div className={styles.sectionHeaderRight}>
            <span className={styles.unit}>(단위: 원)</span>
            <button className={styles.downloadBtn} onClick={handleExport}>
              엑셀 다운로드
            </button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>항목</th>
              <th style={{ textAlign: "right" }}>금액</th>
            </tr>
          </thead>
          <tbody>
            {renderSection("영업활동으로 인한 현금흐름", data.operating)}
            {renderSection("투자활동으로 인한 현금흐름", data.investing)}
            {renderSection("재무활동으로 인한 현금흐름", data.financing)}

            <tr className={styles.grandTotalRow}>
              <td>현금 순증감</td>
              <td style={{ textAlign: "right" }}>
                {data.netCashChange >= 0 ? "" : "-"}₩{fmt(Math.abs(data.netCashChange))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={styles.summaryBar}>
        <div className={styles.summaryBarItem}>
          <span className={styles.summaryBarLabel}>기초 현금</span>
          <span className={styles.summaryBarValue}>₩{fmt(data.openingCash)}</span>
        </div>
        <div className={styles.summaryBarItem}>
          <span className={styles.summaryBarLabel}>현금 순증감</span>
          <span className={`${styles.summaryBarValue} ${data.netCashChange >= 0 ? styles.positive : styles.negative}`}>
            {data.netCashChange >= 0 ? "+" : "-"}₩{fmt(Math.abs(data.netCashChange))}
          </span>
        </div>
        <div className={styles.summaryBarItem}>
          <span className={styles.summaryBarLabel}>기말 현금</span>
          <span className={styles.summaryBarValue}>₩{fmt(data.closingCash)}</span>
        </div>
      </div>
    </>
  );
}

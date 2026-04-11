"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import styles from "./CashFlow.module.css";
import { fmt } from "./types";
import type { CashForecast } from "./types";

interface Props {
  data: CashForecast;
}

export function CashForecastView({ data }: Props) {
  // 과거 + 미래 데이터를 합쳐서 차트로 표시
  const historyWithBalance: { month: string; inflow: number; outflow: number; balance: number; type: "history" | "forecast" }[] = [];
  let runningBalance = data.currentBalance - data.history.reduce((s, h) => s + h.net, 0);
  for (const h of data.history) {
    runningBalance += h.net;
    historyWithBalance.push({
      month: h.month.slice(5),
      inflow: h.inflow,
      outflow: -h.outflow, // 음수로 표시
      balance: runningBalance,
      type: "history",
    });
  }
  for (const f of data.forecast) {
    historyWithBalance.push({
      month: `${f.month.slice(5)}*`,
      inflow: f.inflow,
      outflow: -f.outflow,
      balance: f.balance,
      type: "forecast",
    });
  }

  const lastForecast = data.forecast[data.forecast.length - 1];
  const isLowBalance = lastForecast && lastForecast.balance < 0;

  return (
    <div>
      {/* 요약 카드 */}
      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>현재 잔액</div>
          <div className={styles.summaryValue}>₩{fmt(data.currentBalance)}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>월평균 입금</div>
          <div className={styles.summaryValue} style={{ color: "#16a34a" }}>
            ₩{fmt(data.avgInflow)}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>월평균 출금</div>
          <div className={styles.summaryValue} style={{ color: "#dc2626" }}>
            ₩{fmt(data.avgOutflow)}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>월평균 순현금</div>
          <div
            className={styles.summaryValue}
            style={{ color: data.avgNet >= 0 ? "#16a34a" : "#dc2626" }}
          >
            {data.avgNet >= 0 ? "+" : ""}₩{fmt(data.avgNet)}
          </div>
        </div>
      </div>

      {isLowBalance && (
        <div className={styles.warningBanner}>
          ⚠️ 향후 3개월 후 예상 잔액이 음수가 됩니다. 자금 조달을 검토하세요.
        </div>
      )}

      {/* 차트 */}
      <div className={styles.chartSection}>
        <h2 className={styles.sectionTitle}>자금 흐름 예측 (최근 6개월 + 향후 3개월)</h2>
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={historyWithBalance}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e4f0" />
            <XAxis dataKey="month" fontSize={12} />
            <YAxis fontSize={12} tickFormatter={(v) => `₩${(v / 10000).toFixed(0)}만`} />
            <Tooltip
              formatter={(v, name) => {
                const num = Number(v ?? 0);
                const label = String(name ?? "");
                const val = label === "출금" ? Math.abs(num) : num;
                return [`₩${fmt(val)}`, label];
              }}
            />
            <Legend />
            <ReferenceLine y={0} stroke="#666" />
            <Bar dataKey="inflow" name="입금" fill="#16a34a" />
            <Bar dataKey="outflow" name="출금" fill="#dc2626" />
            <Line type="monotone" dataKey="balance" name="누적 잔액" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
        <p className={styles.chartNote}>
          * 표시는 예측치 (최근 6개월 평균 기반)
        </p>
      </div>

      {/* 예측 테이블 */}
      <div className={styles.tableSection}>
        <h2 className={styles.sectionTitle}>예측 상세</h2>
        <table>
          <thead>
            <tr>
              <th>월</th>
              <th>예상 입금</th>
              <th>예상 출금</th>
              <th>순 현금</th>
              <th>예상 잔액</th>
            </tr>
          </thead>
          <tbody>
            {data.forecast.map((f) => (
              <tr key={f.month}>
                <td>{f.month}</td>
                <td style={{ textAlign: "right", color: "#16a34a" }}>₩{fmt(f.inflow)}</td>
                <td style={{ textAlign: "right", color: "#dc2626" }}>₩{fmt(f.outflow)}</td>
                <td style={{ textAlign: "right", color: f.net >= 0 ? "#16a34a" : "#dc2626" }}>
                  {f.net >= 0 ? "+" : ""}₩{fmt(f.net)}
                </td>
                <td style={{ textAlign: "right", fontWeight: 600, color: f.balance >= 0 ? "var(--primary)" : "#dc2626" }}>
                  ₩{fmt(f.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

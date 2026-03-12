"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import styles from "./page.module.css";

interface ExchangeRate {
  id: string;
  currency: string;
  rate: string;
  date: string;
  createdAt: string;
}

const CURRENCIES = [
  { code: "USD", name: "미국 달러", symbol: "$" },
  { code: "EUR", name: "유로", symbol: "€" },
  { code: "JPY", name: "일본 엔", symbol: "¥" },
  { code: "CNY", name: "중국 위안", symbol: "¥" },
  { code: "GBP", name: "영국 파운드", symbol: "£" },
];

export default function ExchangeRatesPage() {
  const { tenantId, canEdit } = useAuth();
  const queryClient = useQueryClient();

  const [currency, setCurrency] = useState("USD");
  const [rate, setRate] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: rates = [] } = useQuery({
    queryKey: ["exchange-rates"],
    queryFn: () => apiGet<ExchangeRate[]>(`/exchange-rates?tenantId=${tenantId}`),
  });

  const createMut = useMutation({
    mutationFn: (body: { tenantId: string; currency: string; rate: number; date: string }) =>
      apiPost<ExchangeRate>("/exchange-rates", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
      setRate("");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/exchange-rates/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exchange-rates"] }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rate || Number(rate) <= 0) return;
    createMut.mutate({
      tenantId: tenantId!,
      currency,
      rate: Number(rate),
      date,
    });
  };

  // 통화별 그룹핑
  const grouped: Record<string, ExchangeRate[]> = {};
  rates.forEach((r) => {
    if (!grouped[r.currency]) grouped[r.currency] = [];
    grouped[r.currency].push(r);
  });

  return (
    <div>
      <h1 className={styles.title}>환율 관리</h1>

      {canEdit && (
        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>환율 등록</h2>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formRow}>
              <label className={styles.label}>통화</label>
              <select
                className={styles.select}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formRow}>
              <label className={styles.label}>환율 (1 {currency} = ? KRW)</label>
              <input
                className={styles.input}
                type="number"
                step="0.000001"
                min="0"
                placeholder="예: 1350.50"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                required
              />
            </div>
            <div className={styles.formRow}>
              <label className={styles.label}>기준일</label>
              <input
                className={styles.input}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={createMut.isPending}
            >
              {createMut.isPending ? "등록 중..." : "환율 등록"}
            </button>
          </form>
        </div>
      )}

      <div className={styles.tableSection}>
        <h2 className={styles.sectionTitle}>환율 목록</h2>
        {Object.keys(grouped).length === 0 ? (
          <p className={styles.empty}>등록된 환율이 없습니다</p>
        ) : (
          Object.entries(grouped).map(([cur, items]) => {
            const currInfo = CURRENCIES.find((c) => c.code === cur);
            return (
              <div key={cur} className={styles.currencyGroup}>
                <h3 className={styles.currencyTitle}>
                  {cur} {currInfo ? `- ${currInfo.name}` : ""}
                </h3>
                <table>
                  <thead>
                    <tr>
                      <th>기준일</th>
                      <th>환율 (1 {cur} = KRW)</th>
                      <th>등록일</th>
                      {canEdit && <th>관리</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r) => (
                      <tr key={r.id}>
                        <td>{new Date(r.date).toLocaleDateString("ko-KR")}</td>
                        <td>{Number(r.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</td>
                        <td>{new Date(r.createdAt).toLocaleDateString("ko-KR")}</td>
                        {canEdit && (
                          <td>
                            <button
                              className={styles.deleteBtn}
                              onClick={() => {
                                if (confirm("이 환율 정보를 삭제하시겠습니까?")) {
                                  deleteMut.mutate(r.id);
                                }
                              }}
                            >
                              삭제
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

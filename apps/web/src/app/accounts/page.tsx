"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet, TENANT_ID } from "@/lib/api";
import styles from "./page.module.css";

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  normalBalance: string;
}

const typeMap: Record<string, { text: string; cls: string }> = {
  ASSET: { text: "자산", cls: styles.typeAsset },
  LIABILITY: { text: "부채", cls: styles.typeLiability },
  EQUITY: { text: "자본", cls: styles.typeEquity },
  REVENUE: { text: "수익", cls: styles.typeRevenue },
  EXPENSE: { text: "비용", cls: styles.typeExpense },
};

export default function AccountsPage() {
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiGet<Account[]>(`/accounts?tenantId=${TENANT_ID}`),
  });

  return (
    <div>
      <h1 className={styles.title}>계정과목</h1>

      <div className={styles.tableSection}>
        <table>
          <thead>
            <tr>
              <th>코드</th>
              <th>계정명</th>
              <th>유형</th>
              <th>정상잔액</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((acc) => {
              const t = typeMap[acc.type] || { text: acc.type, cls: "" };
              return (
                <tr key={acc.id}>
                  <td>{acc.code}</td>
                  <td>{acc.name}</td>
                  <td>
                    <span className={`${styles.type} ${t.cls}`}>{t.text}</span>
                  </td>
                  <td>{acc.normalBalance === "DEBIT" ? "차변" : "대변"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

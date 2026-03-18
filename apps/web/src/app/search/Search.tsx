"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import styles from "./Search.module.css";

interface SearchItem {
  id: string;
  title: string;
  subtitle?: string;
  link: string;
}

interface SearchGroup {
  entity: string;
  label: string;
  items: SearchItem[];
}

interface SearchResponse {
  results: SearchGroup[];
  totalCount: number;
}

export default function SearchPage() {
  const { tenantId } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const q = searchParams.get("q") || "";

  const { data, isLoading } = useQuery({
    queryKey: ["search", tenantId, q],
    queryFn: () =>
      apiGet<SearchResponse>(
        `/search?tenantId=${tenantId}&q=${encodeURIComponent(q)}&limit=20`,
      ),
    enabled: !!tenantId && !!q,
  });

  if (!q) {
    return (
      <div>
        <h1 className={styles.title}>검색</h1>
        <p className={styles.empty}>검색어를 입력해주세요.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className={styles.title}>검색 결과</h1>
      <p className={styles.subtitle}>
        &quot;{q}&quot; 검색 결과 {data ? `${data.totalCount}건` : ""}
      </p>

      {isLoading && <p className={styles.loading}>검색 중...</p>}

      {data && data.results.length === 0 && (
        <p className={styles.empty}>검색 결과가 없습니다.</p>
      )}

      {data && data.results.length > 0 && (
        <div className={styles.groups}>
          {data.results.map((group) => (
            <div key={group.entity} className={styles.group}>
              <div className={styles.groupHeader}>
                <span className={styles.groupLabel}>{group.label}</span>
                <span className={styles.groupCount}>{group.items.length}건</span>
              </div>
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className={styles.item}
                  onClick={() => router.push(item.link)}
                >
                  <span className={styles.itemTitle}>{item.title}</span>
                  {item.subtitle && (
                    <span className={styles.itemSub}>{item.subtitle}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

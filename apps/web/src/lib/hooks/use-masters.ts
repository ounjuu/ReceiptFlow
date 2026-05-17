// 도메인 공통 마스터 데이터 훅 (계정과목/프로젝트/부서)
// 여러 페이지(journals/journal-templates/fixed-assets/general-ledger/journal-rules 등)에서
// 동일한 fetch를 반복 작성하던 패턴 통합.
// queryKey에 tenantId를 포함시켜 멀티 테넌트 cache 격리.

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

// 페이지마다 Account/ProjectOption/DepartmentOption의 필드가 약간씩 달라
// 제네릭 T로 받아 호출처 타입에 맞춤. 페이지의 기존 type alias 그대로 사용 가능.
type ExtraOptions<T> = Omit<UseQueryOptions<T[]>, "queryKey" | "queryFn">;

type Nullable = string | null | undefined;

export function useAccounts<T = unknown>(tenantId: Nullable, opts: ExtraOptions<T> = {}) {
  return useQuery<T[]>({
    queryKey: ["accounts", tenantId],
    queryFn: () => apiGet<T[]>(`/accounts?tenantId=${tenantId}`),
    enabled: !!tenantId && (opts.enabled ?? true),
    ...opts,
  });
}

export function useProjects<T = unknown>(tenantId: Nullable, opts: ExtraOptions<T> = {}) {
  return useQuery<T[]>({
    queryKey: ["projects", tenantId],
    queryFn: () => apiGet<T[]>(`/projects?tenantId=${tenantId}`),
    enabled: !!tenantId && (opts.enabled ?? true),
    ...opts,
  });
}

export function useDepartments<T = unknown>(tenantId: Nullable, opts: ExtraOptions<T> = {}) {
  return useQuery<T[]>({
    queryKey: ["departments", tenantId],
    queryFn: () => apiGet<T[]>(`/departments?tenantId=${tenantId}`),
    enabled: !!tenantId && (opts.enabled ?? true),
    ...opts,
  });
}

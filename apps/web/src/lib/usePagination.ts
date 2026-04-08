import { useState, useMemo } from "react";

interface PaginationResult<T> {
  pageData: T[];
  page: number;
  totalPages: number;
  total: number;
  setPage: (p: number) => void;
  pageSize: number;
}

export function usePagination<T>(data: T[], pageSize = 50): PaginationResult<T> {
  const [page, setPage] = useState(1);

  const total = data.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // 데이터 변경 시 page 범위 보정
  const safePage = Math.min(page, totalPages);

  const pageData = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, safePage, pageSize]);

  return { pageData, page: safePage, totalPages, total, setPage, pageSize };
}

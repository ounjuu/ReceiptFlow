// Frontend/Backend 공유 타입 모듈

/**
 * 페이지네이션 요청 파라미터 (1-based page).
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * 페이지네이션 응답 envelope.
 */
export interface PaginationResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

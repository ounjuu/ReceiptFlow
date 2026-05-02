// 날짜 포맷 공통 유틸

/**
 * 연/월을 "YYYY-MM" 형식으로 변환한다.
 * @param year 연도 (예: 2026)
 * @param month 월 (1-12)
 */
export function formatYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Date 객체를 "YYYY-MM" 형식으로 변환한다 (로컬 타임존 기준, getMonth+1).
 */
export function formatDateYearMonth(date: Date): string {
  return formatYearMonth(date.getFullYear(), date.getMonth() + 1);
}

// 공용 포맷터/날짜 헬퍼

export const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString();

export const fmtKR = (n: number | null | undefined) => (n ?? 0).toLocaleString("ko-KR");

export const today = () => new Date().toISOString().slice(0, 10);

// 날짜만 (ko-KR). null/undefined → "-"
export const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("ko-KR") : "-";

// 일시 (ko-KR). null/undefined → "-"
export const fmtDateTime = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString("ko-KR") : "-";

// 금액 + "원" (ko-KR). null/undefined → "0원"
export const fmtMoney = (n: number | string | null | undefined) =>
  `${Number(n ?? 0).toLocaleString("ko-KR")}원`;

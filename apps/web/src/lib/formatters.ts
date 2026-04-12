// 공용 포맷터/날짜 헬퍼

export const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString();

export const fmtKR = (n: number | null | undefined) => (n ?? 0).toLocaleString("ko-KR");

export const today = () => new Date().toISOString().slice(0, 10);

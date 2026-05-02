// 전표(Journal) 도메인 상수

// 상태 전이 규칙: 현재 상태에서 이동 가능한 다음 상태들
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["APPROVED", "PENDING_APPROVAL", "POSTED"],
  PENDING_APPROVAL: ["APPROVED", "DRAFT"],
  APPROVED: ["POSTED", "DRAFT"],
  POSTED: [],
};

// 상태 한글 라벨 (출력용)
export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "임시",
  PENDING_APPROVAL: "결재중",
  APPROVED: "승인",
  POSTED: "확정",
};

// 전표유형 한글 라벨 (PDF 표시 + 채번 prefix 공용)
export const JOURNAL_TYPE_LABEL: Record<string, string> = {
  GENERAL: "일반",
  PURCHASE: "매입",
  SALES: "매출",
  CASH: "자금",
};

// 증빙유형 한글 라벨 (출력용)
export const EVIDENCE_TYPE_LABEL: Record<string, string> = {
  TAX_INVOICE: "세금계산서",
  INVOICE: "계산서",
  CARD: "신용카드",
  CASH_RECEIPT: "현금영수증",
  RECEIPT: "간이영수증",
  NONE: "증빙없음",
};

export interface ApprovalLine {
  id: string;
  documentType: string;
  step: number;
  approverId: string;
  approver: { id: string; name: string; email: string };
}

export interface ApprovalActionItem {
  id: string;
  step: number;
  approverId: string;
  approver: { id: string; name: string };
  action: string;
  comment: string | null;
  createdAt: string;
}

export interface PendingApproval {
  id: string;
  documentType: string;
  documentId: string;
  currentStep: number;
  totalSteps: number;
  status: string;
  submittedBy: string;
  submitterName: string;
  createdAt: string;
  documentInfo: { description: string; date: string };
  actions: ApprovalActionItem[];
}

export interface Submission {
  id: string;
  documentType: string;
  documentId: string;
  currentStep: number;
  totalSteps: number;
  status: string;
  createdAt: string;
  documentInfo: { description: string; date: string };
  actions: ApprovalActionItem[];
}

export interface Member {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: string;
}

export const DOC_TYPE_LABEL: Record<string, string> = {
  JOURNAL: "전표",
  TAX_INVOICE: "세금계산서",
  EXPENSE_CLAIM: "경비 정산",
};

export const STATUS_LABEL: Record<string, string> = {
  PENDING: "진행중",
  APPROVED: "승인완료",
  REJECTED: "반려",
};

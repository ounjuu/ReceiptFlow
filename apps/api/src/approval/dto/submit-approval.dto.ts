export class SubmitApprovalDto {
  tenantId!: string;
  documentType!: string; // JOURNAL, TAX_INVOICE
  documentId!: string;
}

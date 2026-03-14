export class SetApprovalLinesDto {
  tenantId!: string;
  documentType!: string; // JOURNAL, TAX_INVOICE
  lines!: { step: number; approverId: string }[];
}

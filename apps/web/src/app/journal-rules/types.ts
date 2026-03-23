export interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

export interface JournalRule {
  id: string;
  name: string;
  vendorName: string | null;
  keywords: string | null;
  amountMin: number | null;
  amountMax: number | null;
  debitAccount: Account;
  creditAccount: Account;
  priority: number;
  enabled: boolean;
}

export interface RuleForm {
  name: string;
  vendorName: string;
  keywords: string;
  amountMin: string;
  amountMax: string;
  debitAccountId: string;
  creditAccountId: string;
  priority: string;
}

export const emptyForm: RuleForm = {
  name: "",
  vendorName: "",
  keywords: "",
  amountMin: "",
  amountMax: "",
  debitAccountId: "",
  creditAccountId: "",
  priority: "0",
};

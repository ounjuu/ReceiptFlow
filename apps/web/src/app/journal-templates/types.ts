export interface Account {
  id: string;
  code: string;
  name: string;
}

export interface TemplateLine {
  debit: string;
  credit: string;
  account: { id: string; code: string; name: string };
  vendor: { id: string; name: string } | null;
}

export interface JournalTemplate {
  id: string;
  name: string;
  description: string | null;
  lines: TemplateLine[];
}

export interface LineInput {
  accountId: string;
  vendorId: string;
  debit: number;
  credit: number;
}

export const emptyLine = (): LineInput => ({ accountId: "", vendorId: "", debit: 0, credit: 0 });

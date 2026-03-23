export interface Vendor {
  id: string;
  name: string;
  bizNo: string | null;
  createdAt: string;
}

export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  results: { index: number; status: string; error?: string }[];
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string | null;
  unit: string | null;
  standardCost: number | null;
  safetyStock: number;
  description: string | null;
}

export interface ItemCost {
  itemName: string;
  totalQty: number;
  totalAmount: number;
  avgUnitCost: number;
  tradeCount: number;
}

export interface VendorCost {
  vendorId: string;
  vendorName: string;
  bizNo: string | null;
  totalAmount: number;
  tradeCount: number;
}

export interface ProjectCost {
  projectId: string;
  code: string;
  name: string;
  totalCost: number;
}

export interface DeptCost {
  departmentId: string;
  code: string;
  name: string;
  totalCost: number;
}

export interface VarianceRow {
  itemName: string;
  productCode: string | null;
  category: string | null;
  unit: string | null;
  quantity: number;
  standardCost: number | null;
  actualUnitCost: number;
  standardTotal: number | null;
  actualTotal: number;
  variance: number | null;
  varianceRate: number | null;
}

export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  results: { index: number; status: string; error?: string }[];
}

export const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString();

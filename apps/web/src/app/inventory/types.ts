export interface Product {
  id: string;
  code: string;
  name: string;
  category: string | null;
  unit: string | null;
}

export interface StockItem {
  id: string;
  code: string;
  name: string;
  category: string | null;
  unit: string | null;
  currentStock: number;
  avgCost: number;
  stockValue: number;
  safetyStock: number;
  isLow: boolean;
}

export interface InventoryTx {
  id: string;
  txNo: string;
  txType: string;
  txDate: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  reason: string | null;
  beforeStock: number;
  afterStock: number;
  product: Product;
  createdAt: string;
}

export interface Summary {
  totalProducts: number;
  totalStockValue: number;
  lowStockCount: number;
  zeroStockCount: number;
}

export interface ValuationItem {
  id: string;
  code: string;
  name: string;
  category: string | null;
  unit: string | null;
  currentStock: number;
  avgCost: number;
  valuationAmount: number;
}

export interface LowStockItem {
  id: string;
  code: string;
  name: string;
  category: string | null;
  unit: string | null;
  currentStock: number;
  safetyStock: number;
  shortage: number;
  avgCost: number;
}

export const TX_TYPE_LABEL: Record<string, string> = {
  IN: "입고",
  OUT: "출고",
  ADJUST: "조정",
};

export const TX_TYPE_STYLE: Record<string, string> = {
  IN: "badgeIn",
  OUT: "badgeOut",
  ADJUST: "badgeAdjust",
};

export const fmt = (n: number) => n.toLocaleString();

export const today = () => new Date().toISOString().slice(0, 10);

export interface FixedAssetSummary {
  id: string;
  name: string;
  description: string | null;
  assetAccountCode: string;
  assetAccountName: string;
  acquisitionDate: string;
  acquisitionCost: number;
  usefulLifeMonths: number;
  residualValue: number;
  depreciationMethod: string;
  status: string;
  accumulatedDep: number;
  bookValue: number;
}

export interface DepRecord {
  id: string;
  period: string;
  amount: number;
  accumulatedAmount: number;
  bookValue: number;
  journalEntryId: string | null;
}

export interface FixedAssetDetail {
  id: string;
  name: string;
  description: string | null;
  assetAccount: { code: string; name: string };
  depreciationAccount: { code: string; name: string };
  accumulatedDepAccount: { code: string; name: string };
  acquisitionDate: string;
  acquisitionCost: number;
  usefulLifeMonths: number;
  residualValue: number;
  depreciationMethod: string;
  status: string;
  disposalDate: string | null;
  disposalAmount: number | null;
  depreciationRecords: DepRecord[];
}

export interface ScheduleRow {
  period: string;
  amount: number;
  accumulatedAmount: number;
  bookValue: number;
  isActual: boolean;
}

export interface ScheduleData {
  assetName: string;
  acquisitionCost: number;
  residualValue: number;
  usefulLifeMonths: number;
  depreciationMethod: string;
  schedule: ScheduleRow[];
}

export interface AccountOption {
  id: string;
  code: string;
  name: string;
}

export interface DepResult {
  period: string;
  processedCount: number;
  totalAmount: number;
  details: { assetId: string; assetName: string; amount: number }[];
}

export const fmt = (n: number) => n.toLocaleString();

export const METHOD_LABEL: Record<string, string> = {
  STRAIGHT_LINE: "정액법",
  DECLINING_BALANCE: "정률법",
};

export const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "사용중",
  DISPOSED: "처분",
  FULLY_DEPRECIATED: "상각완료",
};

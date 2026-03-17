import * as XLSX from "xlsx";
import { exportToXlsx } from "./export-xlsx";

/**
 * 엑셀 파일을 파싱하여 첫 시트의 데이터를 반환
 * 첫 행을 헤더로 사용
 */
export async function parseXlsx(
  file: File,
): Promise<Record<string, string>[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, string>>(ws, {
    defval: "",
    raw: false,
  });
}

/**
 * 빈 엑셀 템플릿 다운로드
 */
export function downloadTemplate(filename: string, headers: string[]) {
  exportToXlsx(filename, "템플릿", headers, []);
}

import * as XLSX from "xlsx";

/**
 * 데이터를 엑셀 파일로 다운로드
 * @param filename 파일명 (.xlsx 자동 추가)
 * @param sheetName 시트 이름
 * @param headers 헤더 배열
 * @param rows 데이터 행 배열 (각 행은 값 배열)
 */
export function exportToXlsx(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
) {
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // 컬럼 너비 자동 설정
  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(
      h.length * 2, // 한글은 2바이트
      ...rows.map((r) => {
        const v = r[i];
        if (v == null) return 0;
        return String(v).length * 1.5;
      }),
    );
    return { wch: Math.min(Math.max(maxLen, 8), 30) };
  });
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

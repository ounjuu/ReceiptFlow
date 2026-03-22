import { Injectable } from "@nestjs/common";

@Injectable()
export class FilingExportService {
  // 부가세 신고서 XML 생성 (홈택스 형식)
  generateVatXml(filingData: Record<string, unknown>): string {
    const salesTax = filingData.salesTaxInvoice as Record<string, unknown> || {};
    const purchaseTax = filingData.purchaseTaxInvoice as Record<string, unknown> || {};
    const salesList = (filingData.salesList as Array<Record<string, unknown>>) || [];
    const purchaseList = (filingData.purchaseList as Array<Record<string, unknown>>) || [];

    // 매출 거래처 XML
    const salesVendorXml = salesList.map((v) =>
      `      <거래처>
        <사업자등록번호>${this.escapeXml(String(v.bizNo))}</사업자등록번호>
        <상호>${this.escapeXml(String(v.name))}</상호>
        <매수>${v.count}</매수>
        <공급가액>${v.supplyAmount}</공급가액>
        <세액>${v.taxAmount}</세액>
      </거래처>`,
    ).join("\n");

    // 매입 거래처 XML
    const purchaseVendorXml = purchaseList.map((v) =>
      `      <거래처>
        <사업자등록번호>${this.escapeXml(String(v.bizNo))}</사업자등록번호>
        <상호>${this.escapeXml(String(v.name))}</상호>
        <매수>${v.count}</매수>
        <공급가액>${v.supplyAmount}</공급가액>
        <세액>${v.taxAmount}</세액>
      </거래처>`,
    ).join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<부가가치세신고서>
  <신고기간>
    <시작일>${filingData.periodStart}</시작일>
    <종료일>${filingData.periodEnd}</종료일>
  </신고기간>
  <매출세금계산서>
    <매수>${salesTax.count || 0}</매수>
    <공급가액>${salesTax.supplyAmount || 0}</공급가액>
    <세액>${salesTax.taxAmount || 0}</세액>
    <거래처목록>
${salesVendorXml}
    </거래처목록>
  </매출세금계산서>
  <매입세금계산서>
    <매수>${purchaseTax.count || 0}</매수>
    <공급가액>${purchaseTax.supplyAmount || 0}</공급가액>
    <세액>${purchaseTax.taxAmount || 0}</세액>
    <거래처목록>
${purchaseVendorXml}
    </거래처목록>
  </매입세금계산서>
  <차감납부세액>${filingData.netTax || 0}</차감납부세액>
  <가산세>${filingData.additionalTax || 0}</가산세>
  <최종납부세액>${filingData.finalTax || 0}</최종납부세액>
</부가가치세신고서>`;
  }

  // 범용 CSV 생성 (BOM 포함, 한글 Excel 호환)
  generateCsv(headers: string[], rows: string[][]): string {
    const bom = "\uFEFF";
    const headerLine = headers.join(",");
    const dataLines = rows.map((row) =>
      row.map((cell) => {
        // 쉼표나 줄바꿈이 포함된 셀은 따옴표로 감싸기
        if (cell.includes(",") || cell.includes("\n") || cell.includes('"')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(","),
    );

    return bom + [headerLine, ...dataLines].join("\n");
  }

  // XML 특수문자 이스케이프
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}

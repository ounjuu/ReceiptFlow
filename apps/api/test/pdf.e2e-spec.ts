import { JournalPdfService } from "../src/journal/journal-pdf.service";
import { TaxInvoicePdfService } from "../src/tax-invoice/tax-invoice-pdf.service";
import { TradePdfService } from "../src/trade/trade-pdf.service";
import { PayrollPdfService } from "../src/payroll/payroll-pdf.service";

// PDF 4종이 정상 바이너리(Buffer, %PDF 헤더, 충분한 크기)를 생성하는지 검증한다.
// 폰트 누락/import 방식 깨짐 등의 회귀를 방지한다.
describe("PDF 생성 회귀 검증", () => {
  const expectValidPdf = (buf: Buffer) => {
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  };

  it("전표 PDF 생성", async () => {
    const buf = await new JournalPdfService().generatePdf({
      journalNumber: "JV-001",
      journalType: "GENERAL",
      date: new Date(),
      description: "테스트",
      status: "DRAFT",
      lines: [],
    });
    expectValidPdf(buf);
  });

  it("세금계산서 PDF 생성", async () => {
    const buf = await new TaxInvoicePdfService().generatePdf({
      invoiceType: "SALES",
      invoiceDate: new Date(),
      issuerBizNo: "1234567890",
      issuerName: "테스트",
      recipientBizNo: "0000000000",
      recipientName: "수신",
      items: [],
      supplyAmount: 1000,
      vatAmount: 100,
      totalAmount: 1100,
    });
    expectValidPdf(buf);
  });

  it("거래명세서 PDF 생성", async () => {
    const buf = await new TradePdfService().generatePdf({
      tradeNo: "T-001",
      tradeType: "SALES",
      tradeDate: new Date(),
      vendor: { name: "거래처", bizNo: "1234567890" },
      lines: [],
      totalAmount: 1000,
      supplyAmount: 1000,
      vatAmount: 100,
      status: "PAID",
    });
    expectValidPdf(buf);
  });

  it("급여명세서 PDF 생성", async () => {
    const buf = await new PayrollPdfService().generatePayslipPdf({
      employeeNo: "E001",
      employeeName: "홍길동",
      department: "개발",
      position: "사원",
      period: "2026-05",
      baseSalary: 3000000,
      overtimePay: 0,
      bonusPay: 0,
      grossPay: 3000000,
      nationalPension: 100000,
      healthInsurance: 100000,
      longTermCare: 10000,
      employmentInsurance: 30000,
      incomeTax: 50000,
      localIncomeTax: 5000,
      totalDeduction: 295000,
      netPay: 2705000,
    });
    expectValidPdf(buf);
  });
});

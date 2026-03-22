import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FilingExportService } from "./filing-export.service";

@Injectable()
export class VatFilingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exportService: FilingExportService,
  ) {}

  // 부가세 신고서 생성
  async generate(tenantId: string, year: number, quarter: number) {
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const startDate = new Date(year, startMonth - 1, 1);
    const endDate = new Date(year, endMonth, 0, 23, 59, 59);

    // 세금계산서 조회
    const invoices = await this.prisma.taxInvoice.findMany({
      where: {
        tenantId,
        invoiceDate: { gte: startDate, lte: endDate },
      },
      include: { vendor: true },
    });

    // 매출 세금계산서
    const salesInvoices = invoices.filter((inv) => inv.invoiceType === "SALES");
    const purchaseInvoices = invoices.filter((inv) => inv.invoiceType === "PURCHASE");

    // 거래처별 매출 합계
    const salesByVendor = new Map<string, { bizNo: string; name: string; count: number; supplyAmount: number; taxAmount: number }>();
    for (const inv of salesInvoices) {
      const key = inv.recipientBizNo;
      const existing = salesByVendor.get(key) || { bizNo: key, name: inv.recipientName, count: 0, supplyAmount: 0, taxAmount: 0 };
      existing.count += 1;
      existing.supplyAmount += Number(inv.supplyAmount);
      existing.taxAmount += Number(inv.taxAmount);
      salesByVendor.set(key, existing);
    }

    // 거래처별 매입 합계
    const purchaseByVendor = new Map<string, { bizNo: string; name: string; count: number; supplyAmount: number; taxAmount: number }>();
    for (const inv of purchaseInvoices) {
      const key = inv.issuerBizNo;
      const existing = purchaseByVendor.get(key) || { bizNo: key, name: inv.issuerName, count: 0, supplyAmount: 0, taxAmount: 0 };
      existing.count += 1;
      existing.supplyAmount += Number(inv.supplyAmount);
      existing.taxAmount += Number(inv.taxAmount);
      purchaseByVendor.set(key, existing);
    }

    const salesList = [...salesByVendor.values()];
    const purchaseList = [...purchaseByVendor.values()];

    const salesTaxInvoice = {
      count: salesInvoices.length,
      supplyAmount: salesList.reduce((s, v) => s + v.supplyAmount, 0),
      taxAmount: salesList.reduce((s, v) => s + v.taxAmount, 0),
    };

    const purchaseTaxInvoice = {
      count: purchaseInvoices.length,
      supplyAmount: purchaseList.reduce((s, v) => s + v.supplyAmount, 0),
      taxAmount: purchaseList.reduce((s, v) => s + v.taxAmount, 0),
    };

    const netTax = salesTaxInvoice.taxAmount - purchaseTaxInvoice.taxAmount;
    const additionalTax = 0; // 사용자가 나중에 수정 가능
    const finalTax = netTax + additionalTax;

    const period = `Q${quarter}`;
    const filingData = {
      salesTaxInvoice,
      purchaseTaxInvoice,
      netTax,
      additionalTax,
      finalTax,
      salesList,
      purchaseList,
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
    };

    // Upsert
    const filing = await this.prisma.taxFiling.upsert({
      where: {
        tenantId_filingType_year_period: {
          tenantId,
          filingType: "VAT",
          year,
          period,
        },
      },
      update: {
        filingData,
        taxableAmount: salesTaxInvoice.supplyAmount - purchaseTaxInvoice.supplyAmount,
        taxAmount: finalTax,
        status: "GENERATED",
        generatedAt: new Date(),
      },
      create: {
        tenantId,
        filingType: "VAT",
        year,
        period,
        filingData,
        taxableAmount: salesTaxInvoice.supplyAmount - purchaseTaxInvoice.supplyAmount,
        taxAmount: finalTax,
        status: "GENERATED",
        generatedAt: new Date(),
      },
    });

    return {
      ...filing,
      taxableAmount: Number(filing.taxableAmount),
      taxAmount: Number(filing.taxAmount),
    };
  }

  // 부가세 CSV 내보내기
  exportCsv(filingData: Record<string, unknown>): string {
    const headers = ["구분", "사업자번호", "상호", "매수", "공급가액", "세액"];
    const rows: string[][] = [];

    const salesList = (filingData.salesList as Array<Record<string, unknown>>) || [];
    for (const v of salesList) {
      rows.push(["매출", String(v.bizNo), String(v.name), String(v.count), String(v.supplyAmount), String(v.taxAmount)]);
    }

    const purchaseList = (filingData.purchaseList as Array<Record<string, unknown>>) || [];
    for (const v of purchaseList) {
      rows.push(["매입", String(v.bizNo), String(v.name), String(v.count), String(v.supplyAmount), String(v.taxAmount)]);
    }

    // 합계행
    const salesTax = filingData.salesTaxInvoice as Record<string, unknown>;
    const purchaseTax = filingData.purchaseTaxInvoice as Record<string, unknown>;
    if (salesTax) {
      rows.push(["매출합계", "", "", String(salesTax.count), String(salesTax.supplyAmount), String(salesTax.taxAmount)]);
    }
    if (purchaseTax) {
      rows.push(["매입합계", "", "", String(purchaseTax.count), String(purchaseTax.supplyAmount), String(purchaseTax.taxAmount)]);
    }
    rows.push(["납부세액", "", "", "", "", String(filingData.finalTax)]);

    return this.exportService.generateCsv(headers, rows);
  }
}

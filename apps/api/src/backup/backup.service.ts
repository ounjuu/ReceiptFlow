import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private readonly prisma: PrismaService) {}

  // 테넌트 데이터 전체 백업 (JSON export)
  async exportData(tenantId: string) {
    const [
      accounts, vendors, vendorMemos, documents,
      journalEntries, journalLines, journalAttachments,
      journalTemplates, journalTemplateLines, journalRules,
      exchangeRates, taxInvoices, taxInvoiceItems,
      fixedAssets, depreciationRecords,
      approvalLines, approvalRequests, approvalActions,
      employees, payrollRecords, budgets,
      projects, departments, products, bomItems,
      trades, tradeItems, payments,
      expenseClaims, expenseClaimItems,
      inventoryTransactions, bankAccounts, bankTransactions,
      yearEndSettlements, taxFilings, summaryCodes,
      accountingPeriods,
    ] = await Promise.all([
      this.prisma.account.findMany({ where: { tenantId } }),
      this.prisma.vendor.findMany({ where: { tenantId } }),
      this.prisma.vendorMemo.findMany({ where: { vendor: { tenantId } } }),
      this.prisma.document.findMany({ where: { tenantId } }),
      this.prisma.journalEntry.findMany({ where: { tenantId } }),
      this.prisma.journalLine.findMany({ where: { journalEntry: { tenantId } } }),
      this.prisma.journalAttachment.findMany({ where: { journalEntry: { tenantId } } }),
      this.prisma.journalTemplate.findMany({ where: { tenantId } }),
      this.prisma.journalTemplateLine.findMany({ where: { journalTemplate: { tenantId } } }),
      this.prisma.journalRule.findMany({ where: { tenantId } }),
      this.prisma.exchangeRate.findMany({ where: { tenantId } }),
      this.prisma.taxInvoice.findMany({ where: { tenantId } }),
      this.prisma.taxInvoiceItem.findMany({ where: { taxInvoice: { tenantId } } }),
      this.prisma.fixedAsset.findMany({ where: { tenantId } }),
      this.prisma.depreciationRecord.findMany({ where: { fixedAsset: { tenantId } } }),
      this.prisma.approvalLine.findMany({ where: { tenantId } }),
      this.prisma.approvalRequest.findMany({ where: { tenantId } }),
      this.prisma.approvalAction.findMany({ where: { approvalRequest: { tenantId } } }),
      this.prisma.employee.findMany({ where: { tenantId } }),
      this.prisma.payrollRecord.findMany({ where: { employee: { tenantId } } }),
      this.prisma.budget.findMany({ where: { tenantId } }),
      this.prisma.project.findMany({ where: { tenantId } }),
      this.prisma.department.findMany({ where: { tenantId } }),
      this.prisma.product.findMany({ where: { tenantId } }),
      this.prisma.bomItem.findMany({ where: { parent: { tenantId } } }),
      this.prisma.trade.findMany({ where: { tenantId } }),
      this.prisma.tradeItem.findMany({ where: { trade: { tenantId } } }),
      this.prisma.payment.findMany({ where: { trade: { tenantId } } }),
      this.prisma.expenseClaim.findMany({ where: { tenantId } }),
      this.prisma.expenseClaimItem.findMany({ where: { expenseClaim: { tenantId } } }),
      this.prisma.inventoryTransaction.findMany({ where: { tenantId } }),
      this.prisma.bankAccount.findMany({ where: { tenantId } }),
      this.prisma.bankTransaction.findMany({ where: { tenantId } }),
      this.prisma.yearEndSettlement.findMany({ where: { employee: { tenantId } } }),
      this.prisma.taxFiling.findMany({ where: { tenantId } }),
      this.prisma.summaryCode.findMany({ where: { tenantId } }),
      this.prisma.accountingPeriod.findMany({ where: { tenantId } }),
    ]);

    return {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      tenantId,
      data: {
        accounts, vendors, vendorMemos, documents,
        journalEntries, journalLines, journalAttachments,
        journalTemplates, journalTemplateLines, journalRules,
        exchangeRates, taxInvoices, taxInvoiceItems,
        fixedAssets, depreciationRecords,
        approvalLines, approvalRequests, approvalActions,
        employees, payrollRecords, budgets,
        projects, departments, products, bomItems,
        trades, tradeItems, payments,
        expenseClaims, expenseClaimItems,
        inventoryTransactions, bankAccounts, bankTransactions,
        yearEndSettlements, taxFilings, summaryCodes,
        accountingPeriods,
      },
      summary: {
        accounts: accounts.length,
        vendors: vendors.length,
        journalEntries: journalEntries.length,
        documents: documents.length,
        trades: trades.length,
        employees: employees.length,
        products: products.length,
      },
    };
  }

  // 백업 데이터 복원 (JSON import)
  async importData(tenantId: string, backup: { version: string; data: Record<string, unknown[]> }) {
    if (!backup.version || !backup.data) {
      throw new BadRequestException("잘못된 백업 파일 형식입니다");
    }

    const data = backup.data;
    let restored = 0;

    await this.prisma.$transaction(async (tx) => {
      // 순서 중요: 의존성 없는 것부터
      if (data.accounts?.length) {
        await tx.account.createMany({ data: data.accounts as never[], skipDuplicates: true });
        restored += (data.accounts as never[]).length;
      }
      if (data.vendors?.length) {
        await tx.vendor.createMany({ data: data.vendors as never[], skipDuplicates: true });
        restored += (data.vendors as never[]).length;
      }
      if (data.departments?.length) {
        await tx.department.createMany({ data: data.departments as never[], skipDuplicates: true });
        restored += (data.departments as never[]).length;
      }
      if (data.projects?.length) {
        await tx.project.createMany({ data: data.projects as never[], skipDuplicates: true });
        restored += (data.projects as never[]).length;
      }
      if (data.products?.length) {
        await tx.product.createMany({ data: data.products as never[], skipDuplicates: true });
        restored += (data.products as never[]).length;
      }
      if (data.employees?.length) {
        await tx.employee.createMany({ data: data.employees as never[], skipDuplicates: true });
        restored += (data.employees as never[]).length;
      }
      if (data.bankAccounts?.length) {
        await tx.bankAccount.createMany({ data: data.bankAccounts as never[], skipDuplicates: true });
        restored += (data.bankAccounts as never[]).length;
      }
      if (data.documents?.length) {
        await tx.document.createMany({ data: data.documents as never[], skipDuplicates: true });
        restored += (data.documents as never[]).length;
      }
      if (data.journalEntries?.length) {
        await tx.journalEntry.createMany({ data: data.journalEntries as never[], skipDuplicates: true });
        restored += (data.journalEntries as never[]).length;
      }
      if (data.journalLines?.length) {
        await tx.journalLine.createMany({ data: data.journalLines as never[], skipDuplicates: true });
        restored += (data.journalLines as never[]).length;
      }
      if (data.summaryCodes?.length) {
        await tx.summaryCode.createMany({ data: data.summaryCodes as never[], skipDuplicates: true });
        restored += (data.summaryCodes as never[]).length;
      }
      if (data.budgets?.length) {
        await tx.budget.createMany({ data: data.budgets as never[], skipDuplicates: true });
        restored += (data.budgets as never[]).length;
      }

      this.logger.log(`백업 복원 완료: ${restored}건 (tenantId: ${tenantId})`);
    });

    return { restored, message: `${restored}건의 데이터가 복원되었습니다` };
  }
}

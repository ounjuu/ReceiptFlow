import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { DocumentModule } from "./document/document.module";
import { JournalModule } from "./journal/journal.module";
import { ReportModule } from "./report/report.module";
import { AccountModule } from "./account/account.module";
import { VendorModule } from "./vendor/vendor.module";
import { ClosingModule } from "./closing/closing.module";
import { AuditLogModule } from "./audit-log/audit-log.module";
import { JournalTemplateModule } from "./journal-template/journal-template.module";
import { ExchangeRateModule } from "./exchange-rate/exchange-rate.module";
import { TaxInvoiceModule } from "./tax-invoice/tax-invoice.module";
import { FixedAssetModule } from "./fixed-asset/fixed-asset.module";
import { ApprovalModule } from "./approval/approval.module";
import { PayrollModule } from "./payroll/payroll.module";
import { BudgetModule } from "./budget/budget.module";
import { ProjectModule } from "./project/project.module";
import { TradeModule } from "./trade/trade.module";
import { DepartmentModule } from "./department/department.module";
import { CostModule } from "./cost-management/cost.module";
import { ExpenseClaimModule } from "./expense-claim/expense-claim.module";
import { InventoryModule } from "./inventory/inventory.module";
import { BankAccountModule } from "./bank-account/bank-account.module";
import { SearchModule } from "./search/search.module";
import { JournalRuleModule } from "./journal-rule/journal-rule.module";
import { YearEndSettlementModule } from "./year-end-settlement/year-end-settlement.module";
import { TaxFilingModule } from "./tax-filing/tax-filing.module";
import { MailModule } from "./mail/mail.module";
import { SummaryCodeModule } from "./summary-code/summary-code.module";
import { BomModule } from "./bom/bom.module";
import { NotificationModule } from "./notification/notification.module";
import { BackupModule } from "./backup/backup.module";

@Module({
  imports: [
    // 분당 100요청 제한 (전역 rate limit). 필요 시 @SkipThrottle/@Throttle로 개별 조정
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule, AuthModule, NotificationModule, DocumentModule, JournalModule, ReportModule, AccountModule, VendorModule, ClosingModule, AuditLogModule, JournalTemplateModule, ExchangeRateModule, TaxInvoiceModule, FixedAssetModule, ApprovalModule, PayrollModule, BudgetModule, ProjectModule, TradeModule, DepartmentModule, CostModule, ExpenseClaimModule, InventoryModule, BankAccountModule, SearchModule, JournalRuleModule, YearEndSettlementModule, TaxFilingModule, MailModule, SummaryCodeModule, BomModule, BackupModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

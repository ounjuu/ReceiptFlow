import { Module } from "@nestjs/common";
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

@Module({
  imports: [PrismaModule, AuthModule, DocumentModule, JournalModule, ReportModule, AccountModule, VendorModule, ClosingModule, AuditLogModule, JournalTemplateModule, ExchangeRateModule, TaxInvoiceModule, FixedAssetModule, ApprovalModule, PayrollModule, BudgetModule, ProjectModule, TradeModule, DepartmentModule, CostModule, ExpenseClaimModule, InventoryModule, BankAccountModule, SearchModule, JournalRuleModule, YearEndSettlementModule, TaxFilingModule, MailModule],
  controllers: [],
  providers: [],
})
export class AppModule {}

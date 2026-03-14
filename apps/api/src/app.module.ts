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

@Module({
  imports: [PrismaModule, AuthModule, DocumentModule, JournalModule, ReportModule, AccountModule, VendorModule, ClosingModule, AuditLogModule, JournalTemplateModule, ExchangeRateModule, TaxInvoiceModule, FixedAssetModule, ApprovalModule],
  controllers: [],
  providers: [],
})
export class AppModule {}

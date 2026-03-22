import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { TaxFilingController } from "./tax-filing.controller";
import { TaxFilingService } from "./tax-filing.service";
import { VatFilingService } from "./vat-filing.service";
import { WithholdingFilingService } from "./withholding-filing.service";
import { CorporateFilingService } from "./corporate-filing.service";
import { FilingExportService } from "./filing-export.service";

@Module({
  imports: [PrismaModule],
  controllers: [TaxFilingController],
  providers: [
    TaxFilingService,
    VatFilingService,
    WithholdingFilingService,
    CorporateFilingService,
    FilingExportService,
  ],
  exports: [TaxFilingService],
})
export class TaxFilingModule {}

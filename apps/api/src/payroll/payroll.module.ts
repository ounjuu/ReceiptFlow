import { Module } from "@nestjs/common";
import { PayrollController } from "./payroll.controller";
import { PayrollService } from "./payroll.service";
import { PayrollPdfService } from "./payroll-pdf.service";
import { JournalModule } from "../journal/journal.module";

@Module({
  imports: [JournalModule],
  controllers: [PayrollController],
  providers: [PayrollService, PayrollPdfService],
})
export class PayrollModule {}

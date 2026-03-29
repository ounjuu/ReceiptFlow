import { Module } from "@nestjs/common";
import { PayrollController } from "./payroll.controller";
import { PayrollService } from "./payroll.service";
import { JournalModule } from "../journal/journal.module";

@Module({
  imports: [JournalModule],
  controllers: [PayrollController],
  providers: [PayrollService],
})
export class PayrollModule {}

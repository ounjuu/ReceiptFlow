import { Module } from "@nestjs/common";
import { ExpenseClaimController } from "./expense-claim.controller";
import { ExpenseClaimService } from "./expense-claim.service";
import { JournalModule } from "../journal/journal.module";

@Module({
  imports: [JournalModule],
  controllers: [ExpenseClaimController],
  providers: [ExpenseClaimService],
})
export class ExpenseClaimModule {}

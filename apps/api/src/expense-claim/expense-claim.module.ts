import { Module } from "@nestjs/common";
import { ExpenseClaimController } from "./expense-claim.controller";
import { ExpenseClaimService } from "./expense-claim.service";

@Module({
  controllers: [ExpenseClaimController],
  providers: [ExpenseClaimService],
})
export class ExpenseClaimModule {}

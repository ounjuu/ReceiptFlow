import { Module } from "@nestjs/common";
import { BankAccountController } from "./bank-account.controller";
import { BankAccountService } from "./bank-account.service";
import { JournalModule } from "../journal/journal.module";

@Module({
  imports: [JournalModule],
  controllers: [BankAccountController],
  providers: [BankAccountService],
})
export class BankAccountModule {}

import { Module } from "@nestjs/common";
import { ApprovalController } from "./approval.controller";
import { ApprovalService } from "./approval.service";
import { MailModule } from "../mail/mail.module";

@Module({
  imports: [MailModule],
  controllers: [ApprovalController],
  providers: [ApprovalService],
})
export class ApprovalModule {}

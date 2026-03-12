import { Module } from "@nestjs/common";
import { TaxInvoiceController } from "./tax-invoice.controller";
import { TaxInvoiceService } from "./tax-invoice.service";

@Module({
  controllers: [TaxInvoiceController],
  providers: [TaxInvoiceService],
})
export class TaxInvoiceModule {}

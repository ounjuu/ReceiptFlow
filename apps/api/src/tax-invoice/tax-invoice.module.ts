import { Module } from "@nestjs/common";
import { TaxInvoiceController } from "./tax-invoice.controller";
import { TaxInvoiceService } from "./tax-invoice.service";
import { TaxInvoicePdfService } from "./tax-invoice-pdf.service";
import { HometaxXmlService } from "./hometax-xml.service";

@Module({
  controllers: [TaxInvoiceController],
  providers: [TaxInvoiceService, TaxInvoicePdfService, HometaxXmlService],
})
export class TaxInvoiceModule {}

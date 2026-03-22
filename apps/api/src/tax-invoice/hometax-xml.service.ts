import { Injectable, BadRequestException } from "@nestjs/common";
import { XMLParser, XMLBuilder } from "fast-xml-parser";

export interface ParsedTaxInvoice {
  issuerBizNo: string;
  issuerName: string;
  recipientBizNo: string;
  recipientName: string;
  invoiceDate: string;
  approvalNo: string;
  supplyAmount: number;
  taxAmount: number;
  totalAmount: number;
  items: ParsedTaxInvoiceItem[];
}

export interface ParsedTaxInvoiceItem {
  sequenceNo: number;
  itemDate?: string;
  itemName?: string;
  specification?: string;
  quantity?: number;
  unitPrice?: number;
  supplyAmount: number;
  taxAmount: number;
  remark?: string;
}

@Injectable()
export class HometaxXmlService {
  private readonly parser: XMLParser;
  private readonly builder: XMLBuilder;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: true,
      trimValues: true,
    });
    this.builder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
      indentBy: "  ",
      suppressEmptyNode: true,
    });
  }

  /**
   * 홈택스 표준 XML을 파싱하여 구조화된 데이터로 변환
   */
  parseXml(xmlString: string): ParsedTaxInvoice {
    let parsed: Record<string, unknown>;
    try {
      parsed = this.parser.parse(xmlString);
    } catch {
      throw new BadRequestException("유효하지 않은 XML 형식입니다");
    }

    const taxInvoice = parsed["TaxInvoice"] as Record<string, unknown>;
    if (!taxInvoice) {
      throw new BadRequestException("TaxInvoice 루트 엘리먼트를 찾을 수 없습니다");
    }

    const exchangedDoc = taxInvoice["ExchangedDocument"] as Record<string, unknown>;
    const settlement = taxInvoice["TaxInvoiceTradeSettlement"] as Record<string, unknown>;

    if (!exchangedDoc || !settlement) {
      throw new BadRequestException("필수 XML 엘리먼트가 누락되었습니다");
    }

    // 발행일 파싱 (YYYYMMDD -> ISO)
    const rawDate = String(exchangedDoc["IssueDateTime"] || "");
    const invoiceDate = this.parseDate(rawDate);

    // 승인번호
    const approvalNo = String(exchangedDoc["ID"] || "");

    // 공급자/공급받는자
    const invoicerParty = settlement["InvoicerParty"] as Record<string, unknown>;
    const invoiceeParty = settlement["InvoiceeParty"] as Record<string, unknown>;

    const issuerBizNo = String(invoicerParty?.["ID"] || "");
    const issuerName = String(invoicerParty?.["NameText"] || "");
    const recipientBizNo = String(invoiceeParty?.["ID"] || "");
    const recipientName = String(invoiceeParty?.["NameText"] || "");

    // 금액
    const monetary = settlement["SpecifiedMonetarySummation"] as Record<string, unknown>;
    const supplyAmount = Number(monetary?.["ChargeTotalAmount"] || 0);
    const taxAmount = Number(monetary?.["TaxTotalAmount"] || 0);
    const totalAmount = Number(monetary?.["GrandTotalAmount"] || 0);

    // 품목 (단일 또는 배열)
    const rawItems = taxInvoice["TaxInvoiceTradeLineItem"];
    const items = this.parseItems(rawItems);

    return {
      issuerBizNo,
      issuerName,
      recipientBizNo,
      recipientName,
      invoiceDate,
      approvalNo,
      supplyAmount,
      taxAmount,
      totalAmount,
      items,
    };
  }

  /**
   * DB 데이터를 홈택스 표준 XML로 변환
   */
  generateXml(invoice: {
    approvalNo?: string | null;
    invoiceDate: Date;
    issuerBizNo: string;
    issuerName: string;
    recipientBizNo: string;
    recipientName: string;
    supplyAmount: number | { toString(): string };
    taxAmount: number | { toString(): string };
    totalAmount: number | { toString(): string };
    items: Array<{
      sequenceNo: number;
      itemDate?: Date | null;
      itemName?: string | null;
      specification?: string | null;
      quantity?: number | { toString(): string } | null;
      unitPrice?: number | { toString(): string } | null;
      supplyAmount: number | { toString(): string };
      taxAmount: number | { toString(): string };
      remark?: string | null;
    }>;
  }): string {
    const dateStr = this.formatDate(invoice.invoiceDate);

    const lineItems = invoice.items.map((item) => ({
      SequenceNumeric: item.sequenceNo,
      InvoiceAmount: Number(item.supplyAmount),
      TaxAmount: Number(item.taxAmount),
      NameText: item.itemName || "",
      InformationText: item.specification || "",
      ChargeableUnitQuantity: item.quantity ? Number(item.quantity) : "",
      UnitAmount: item.unitPrice ? Number(item.unitPrice) : "",
      PurchaseExpiryDateTime: item.itemDate ? this.formatDate(item.itemDate) : "",
      DescriptionText: item.remark || "",
    }));

    const xmlObj = {
      "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
      TaxInvoice: {
        ExchangedDocument: {
          IssueDateTime: dateStr,
          ID: invoice.approvalNo || "",
        },
        TaxInvoiceTradeSettlement: {
          InvoicerParty: {
            ID: invoice.issuerBizNo,
            NameText: invoice.issuerName,
          },
          InvoiceeParty: {
            ID: invoice.recipientBizNo,
            NameText: invoice.recipientName,
          },
          SpecifiedMonetarySummation: {
            ChargeTotalAmount: Number(invoice.supplyAmount),
            TaxTotalAmount: Number(invoice.taxAmount),
            GrandTotalAmount: Number(invoice.totalAmount),
          },
        },
        TaxInvoiceTradeLineItem: lineItems.length === 1 ? lineItems[0] : lineItems,
      },
    };

    return this.builder.build(xmlObj);
  }

  /**
   * 승인번호 유효성 검증 (24자리 숫자)
   */
  validateApprovalNo(approvalNo: string): boolean {
    return /^\d{24}$/.test(approvalNo);
  }

  // ─── 내부 유틸 ───────────────────────────────

  private parseDate(raw: string): string {
    // YYYYMMDD -> YYYY-MM-DD
    const cleaned = raw.replace(/\D/g, "");
    if (cleaned.length < 8) return raw;
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
  }

  private formatDate(date: Date): string {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  }

  private parseItems(rawItems: unknown): ParsedTaxInvoiceItem[] {
    if (!rawItems) return [];
    const arr = Array.isArray(rawItems) ? rawItems : [rawItems];
    return arr.map((item: Record<string, unknown>) => ({
      sequenceNo: Number(item["SequenceNumeric"] || 1),
      itemDate: item["PurchaseExpiryDateTime"]
        ? this.parseDate(String(item["PurchaseExpiryDateTime"]))
        : undefined,
      itemName: item["NameText"] ? String(item["NameText"]) : undefined,
      specification: item["InformationText"] ? String(item["InformationText"]) : undefined,
      quantity: item["ChargeableUnitQuantity"] ? Number(item["ChargeableUnitQuantity"]) : undefined,
      unitPrice: item["UnitAmount"] ? Number(item["UnitAmount"]) : undefined,
      supplyAmount: Number(item["InvoiceAmount"] || 0),
      taxAmount: Number(item["TaxAmount"] || 0),
      remark: item["DescriptionText"] ? String(item["DescriptionText"]) : undefined,
    }));
  }
}

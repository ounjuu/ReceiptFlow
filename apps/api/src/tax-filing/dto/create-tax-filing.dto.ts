export class CreateTaxFilingDto {
  filingType!: string; // VAT, CORPORATE, WITHHOLDING
  year!: number;
  period!: string;
  note?: string;
}

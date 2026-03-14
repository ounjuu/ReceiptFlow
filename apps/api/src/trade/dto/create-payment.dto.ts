export class CreatePaymentDto {
  paymentDate!: string;
  amount!: number;
  paymentMethod!: string; // CASH, BANK_TRANSFER, CARD, NOTE
  note?: string;
}

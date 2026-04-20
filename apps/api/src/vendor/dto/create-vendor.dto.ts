export class CreateVendorDto {
  tenantId!: string;
  name!: string;
  bizNo?: string;
  creditRating?: string; // A, B, C, D
  creditLimit?: number;
  note?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  category?: string;
}

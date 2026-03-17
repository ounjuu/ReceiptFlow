export class CreateProductDto {
  tenantId!: string;
  code!: string;
  name!: string;
  category?: string;
  unit?: string;
  standardCost?: number;
  safetyStock?: number;
  description?: string;
}

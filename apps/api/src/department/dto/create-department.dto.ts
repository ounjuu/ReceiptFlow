export class CreateDepartmentDto {
  tenantId!: string;
  code!: string;
  name!: string;
  description?: string;
  manager?: string;
  budget?: number;
}

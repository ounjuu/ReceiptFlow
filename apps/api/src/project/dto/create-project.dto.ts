export class CreateProjectDto {
  tenantId!: string;
  code!: string;
  name!: string;
  description?: string;
  startDate!: string;
  endDate?: string;
  manager?: string;
  budget?: number;
}

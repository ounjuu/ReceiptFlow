export class CreateEmployeeDto {
  tenantId!: string;
  employeeNo!: string;
  name!: string;
  department?: string;
  position?: string;
  joinDate!: string; // ISO 날짜
  baseSalary!: number;
}

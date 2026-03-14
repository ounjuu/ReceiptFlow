import { Injectable, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";

// 4대보험 요율 (2026 기준 근사값)
const RATES = {
  nationalPension: 0.045, // 국민연금 4.5%
  healthInsurance: 0.03545, // 건강보험 3.545%
  longTermCareRate: 0.1281, // 장기요양 = 건강보험의 12.81%
  employmentInsurance: 0.009, // 고용보험 0.9%
};

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  // --- 직원 관리 ---

  async getEmployees(tenantId: string) {
    return this.prisma.employee.findMany({
      where: { tenantId },
      orderBy: { employeeNo: "asc" },
    });
  }

  async getEmployee(id: string) {
    const employee = await this.prisma.employee.findUniqueOrThrow({
      where: { id },
      include: {
        payrollRecords: { orderBy: { period: "desc" } },
      },
    });

    return {
      ...employee,
      baseSalary: Number(employee.baseSalary),
      payrollRecords: employee.payrollRecords.map((r) => ({
        id: r.id,
        period: r.period,
        baseSalary: Number(r.baseSalary),
        overtimePay: Number(r.overtimePay),
        bonusPay: Number(r.bonusPay),
        grossPay: Number(r.grossPay),
        nationalPension: Number(r.nationalPension),
        healthInsurance: Number(r.healthInsurance),
        longTermCare: Number(r.longTermCare),
        employmentInsurance: Number(r.employmentInsurance),
        incomeTax: Number(r.incomeTax),
        localIncomeTax: Number(r.localIncomeTax),
        totalDeduction: Number(r.totalDeduction),
        netPay: Number(r.netPay),
        journalEntryId: r.journalEntryId,
      })),
    };
  }

  async createEmployee(dto: CreateEmployeeDto) {
    const exists = await this.prisma.employee.findFirst({
      where: { tenantId: dto.tenantId, employeeNo: dto.employeeNo },
    });
    if (exists) {
      throw new ConflictException("이미 등록된 사번입니다");
    }

    return this.prisma.employee.create({
      data: {
        tenantId: dto.tenantId,
        employeeNo: dto.employeeNo,
        name: dto.name,
        department: dto.department,
        position: dto.position,
        joinDate: new Date(dto.joinDate),
        baseSalary: dto.baseSalary,
      },
    });
  }

  async updateEmployee(id: string, dto: UpdateEmployeeDto) {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.department !== undefined) data.department = dto.department;
    if (dto.position !== undefined) data.position = dto.position;
    if (dto.baseSalary !== undefined) data.baseSalary = dto.baseSalary;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.leaveDate !== undefined) data.leaveDate = new Date(dto.leaveDate);

    return this.prisma.employee.update({ where: { id }, data });
  }

  // --- 급여 계산 ---

  // 4대보험 + 소득세 계산
  calculateDeductions(grossPay: number) {
    const nationalPension = Math.round(grossPay * RATES.nationalPension);
    const healthInsurance = Math.round(grossPay * RATES.healthInsurance);
    const longTermCare = Math.round(healthInsurance * RATES.longTermCareRate);
    const employmentInsurance = Math.round(grossPay * RATES.employmentInsurance);

    // 소득세: 간이세액표 근사 (월급 구간별)
    const incomeTax = this.calculateIncomeTax(grossPay);
    const localIncomeTax = Math.round(incomeTax * 0.1); // 지방소득세 = 소득세의 10%

    const totalDeduction =
      nationalPension +
      healthInsurance +
      longTermCare +
      employmentInsurance +
      incomeTax +
      localIncomeTax;

    return {
      nationalPension,
      healthInsurance,
      longTermCare,
      employmentInsurance,
      incomeTax,
      localIncomeTax,
      totalDeduction,
      netPay: grossPay - totalDeduction,
    };
  }

  // 간이세액표 근사 (월급 기준, 1인 가구)
  private calculateIncomeTax(monthlyGross: number): number {
    if (monthlyGross <= 1060000) return 0;
    if (monthlyGross <= 1500000) return Math.round((monthlyGross - 1060000) * 0.06);
    if (monthlyGross <= 3000000)
      return Math.round(26400 + (monthlyGross - 1500000) * 0.15);
    if (monthlyGross <= 4500000)
      return Math.round(251400 + (monthlyGross - 3000000) * 0.15);
    if (monthlyGross <= 8700000)
      return Math.round(476400 + (monthlyGross - 4500000) * 0.24);
    return Math.round(1484400 + (monthlyGross - 8700000) * 0.35);
  }

  // --- 월별 급여 처리 ---

  async runMonthlyPayroll(tenantId: string, year: number, month: number) {
    const period = `${year}-${String(month).padStart(2, "0")}`;
    const periodEndDate = new Date(year, month, 0); // 해당 월 말일

    // ACTIVE 직원 조회
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, status: "ACTIVE" },
    });

    // 급여 계정 조회
    const salaryAccount = await this.prisma.account.findFirst({
      where: { tenantId, code: "50100" },
    });

    if (!salaryAccount) {
      throw new BadRequestException("급여 계정(50100)이 없습니다. 계정과목을 확인하세요.");
    }

    // 현금/예금 계정 (대변 — 미지급급여 대신 보통예금 사용)
    const bankAccount = await this.prisma.account.findFirst({
      where: { tenantId, code: "10300" },
    });

    if (!bankAccount) {
      throw new BadRequestException("보통예금 계정(10300)이 없습니다.");
    }

    const results: {
      employeeId: string;
      employeeName: string;
      grossPay: number;
      netPay: number;
    }[] = [];

    for (const emp of employees) {
      // 이미 해당 월 처리된 직원 제외
      const existing = await this.prisma.payrollRecord.findFirst({
        where: { employeeId: emp.id, period },
      });
      if (existing) continue;

      // 입사일 이전 월은 건너뜀
      const joinPeriod = `${emp.joinDate.getFullYear()}-${String(emp.joinDate.getMonth() + 1).padStart(2, "0")}`;
      if (period < joinPeriod) continue;

      const baseSalary = Number(emp.baseSalary);
      const grossPay = baseSalary; // 기본급 = 총지급액 (추가 수당 없으면)
      const deductions = this.calculateDeductions(grossPay);

      await this.prisma.$transaction(async (tx) => {
        // 전표 생성 (차변: 급여, 대변: 보통예금)
        const entry = await tx.journalEntry.create({
          data: {
            tenantId,
            date: periodEndDate,
            description: `${emp.name} ${period} 급여`,
            status: "POSTED",
            lines: {
              create: [
                {
                  accountId: salaryAccount.id,
                  debit: grossPay,
                  credit: 0,
                },
                {
                  accountId: bankAccount.id,
                  debit: 0,
                  credit: grossPay,
                },
              ],
            },
          },
        });

        // PayrollRecord 생성
        await tx.payrollRecord.create({
          data: {
            employeeId: emp.id,
            period,
            baseSalary,
            overtimePay: 0,
            bonusPay: 0,
            grossPay,
            nationalPension: deductions.nationalPension,
            healthInsurance: deductions.healthInsurance,
            longTermCare: deductions.longTermCare,
            employmentInsurance: deductions.employmentInsurance,
            incomeTax: deductions.incomeTax,
            localIncomeTax: deductions.localIncomeTax,
            totalDeduction: deductions.totalDeduction,
            netPay: deductions.netPay,
            journalEntryId: entry.id,
          },
        });
      });

      results.push({
        employeeId: emp.id,
        employeeName: emp.name,
        grossPay,
        netPay: deductions.netPay,
      });
    }

    return {
      period,
      processedCount: results.length,
      totalGross: results.reduce((s, r) => s + r.grossPay, 0),
      totalNet: results.reduce((s, r) => s + r.netPay, 0),
      details: results,
    };
  }

  // 월별 급여 현황 조회
  async getPayrollRecords(tenantId: string, year: number, month: number) {
    const period = `${year}-${String(month).padStart(2, "0")}`;

    const records = await this.prisma.payrollRecord.findMany({
      where: {
        period,
        employee: { tenantId },
      },
      include: {
        employee: { select: { employeeNo: true, name: true, department: true, position: true } },
      },
      orderBy: { employee: { employeeNo: "asc" } },
    });

    return records.map((r) => ({
      id: r.id,
      employeeNo: r.employee.employeeNo,
      employeeName: r.employee.name,
      department: r.employee.department,
      position: r.employee.position,
      period: r.period,
      baseSalary: Number(r.baseSalary),
      overtimePay: Number(r.overtimePay),
      bonusPay: Number(r.bonusPay),
      grossPay: Number(r.grossPay),
      nationalPension: Number(r.nationalPension),
      healthInsurance: Number(r.healthInsurance),
      longTermCare: Number(r.longTermCare),
      employmentInsurance: Number(r.employmentInsurance),
      incomeTax: Number(r.incomeTax),
      localIncomeTax: Number(r.localIncomeTax),
      totalDeduction: Number(r.totalDeduction),
      netPay: Number(r.netPay),
    }));
  }

  // 급여 요약
  async getPayrollSummary(tenantId: string, year: number, month: number) {
    const records = await this.getPayrollRecords(tenantId, year, month);

    const employeeCount = records.length;
    const totalGross = records.reduce((s, r) => s + r.grossPay, 0);
    const totalDeduction = records.reduce((s, r) => s + r.totalDeduction, 0);
    const totalNet = records.reduce((s, r) => s + r.netPay, 0);
    const totalPension = records.reduce((s, r) => s + r.nationalPension, 0);
    const totalHealth = records.reduce((s, r) => s + r.healthInsurance, 0);
    const totalLongTerm = records.reduce((s, r) => s + r.longTermCare, 0);
    const totalEmployment = records.reduce((s, r) => s + r.employmentInsurance, 0);
    const totalIncomeTax = records.reduce((s, r) => s + r.incomeTax, 0);
    const totalLocalTax = records.reduce((s, r) => s + r.localIncomeTax, 0);

    return {
      period: `${year}-${String(month).padStart(2, "0")}`,
      employeeCount,
      totalGross,
      totalDeduction,
      totalNet,
      totalPension,
      totalHealth,
      totalLongTerm,
      totalEmployment,
      totalIncomeTax,
      totalLocalTax,
    };
  }
}

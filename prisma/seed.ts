import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  // ── 테넌트 ──
  const tenant = await prisma.tenant.upsert({
    where: { id: "seed-tenant-001" },
    update: {},
    create: {
      id: "seed-tenant-001",
      name: "테스트 회사",
    },
  });

  // ── 유저 3명 (Admin, Accountant, Viewer) ──
  const hashedAdmin = await bcrypt.hash("admin1234", 10);
  const hashedAccountant = await bcrypt.hash("accountant1234", 10);
  const hashedViewer = await bcrypt.hash("viewer1234", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@ledgerflow.dev" },
    update: { password: hashedAdmin },
    create: {
      id: "seed-user-001",
      email: "admin@ledgerflow.dev",
      password: hashedAdmin,
      name: "관리자",
    },
  });

  const accountant = await prisma.user.upsert({
    where: { email: "accountant@ledgerflow.dev" },
    update: { password: hashedAccountant },
    create: {
      id: "seed-user-002",
      email: "accountant@ledgerflow.dev",
      password: hashedAccountant,
      name: "회계담당자",
    },
  });

  const viewer = await prisma.user.upsert({
    where: { email: "viewer@ledgerflow.dev" },
    update: { password: hashedViewer },
    create: {
      id: "seed-user-003",
      email: "viewer@ledgerflow.dev",
      password: hashedViewer,
      name: "열람자",
    },
  });

  // ── Membership ──
  const memberships = [
    { userId: admin.id, tenantId: tenant.id, role: "ADMIN" },
    { userId: accountant.id, tenantId: tenant.id, role: "ACCOUNTANT" },
    { userId: viewer.id, tenantId: tenant.id, role: "VIEWER" },
  ];

  for (const m of memberships) {
    await prisma.membership.upsert({
      where: { userId_tenantId: { userId: m.userId, tenantId: m.tenantId } },
      update: { role: m.role },
      create: m,
    });
  }

  // ── 계정과목 (COA) ──
  const accounts = [
    // 자산 (1xxxx)
    { code: "10100", name: "현금", type: "ASSET", normalBalance: "DEBIT" },
    { code: "10300", name: "보통예금", type: "ASSET", normalBalance: "DEBIT" },
    { code: "10500", name: "외상매출금", type: "ASSET", normalBalance: "DEBIT" },
    { code: "10800", name: "미수금", type: "ASSET", normalBalance: "DEBIT" },
    { code: "10900", name: "선급금", type: "ASSET", normalBalance: "DEBIT" },
    { code: "11000", name: "선급비용", type: "ASSET", normalBalance: "DEBIT" },
    { code: "11100", name: "부가세대급금", type: "ASSET", normalBalance: "DEBIT" },
    { code: "11300", name: "상품", type: "ASSET", normalBalance: "DEBIT" },
    { code: "11400", name: "제품", type: "ASSET", normalBalance: "DEBIT" },
    { code: "11500", name: "원재료", type: "ASSET", normalBalance: "DEBIT" },
    { code: "13100", name: "토지", type: "ASSET", normalBalance: "DEBIT" },
    { code: "13200", name: "건물", type: "ASSET", normalBalance: "DEBIT" },
    { code: "13300", name: "기계장치", type: "ASSET", normalBalance: "DEBIT" },
    { code: "13400", name: "차량운반구", type: "ASSET", normalBalance: "DEBIT" },
    { code: "13500", name: "비품", type: "ASSET", normalBalance: "DEBIT" },
    { code: "13600", name: "감가상각누계액", type: "ASSET", normalBalance: "CREDIT" },
    // 부채 (2xxxx)
    { code: "20100", name: "외상매입금", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "20300", name: "미지급금", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "20400", name: "미지급비용", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "20500", name: "예수금", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "20600", name: "부가세예수금", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "20700", name: "단기차입금", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "20800", name: "선수금", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "20900", name: "선수수익", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "23100", name: "장기차입금", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "23200", name: "퇴직급여충당부채", type: "LIABILITY", normalBalance: "CREDIT" },
    // 자본 (3xxxx)
    { code: "30100", name: "자본금", type: "EQUITY", normalBalance: "CREDIT" },
    { code: "30300", name: "이익잉여금", type: "EQUITY", normalBalance: "CREDIT" },
    { code: "30500", name: "당기순이익", type: "EQUITY", normalBalance: "CREDIT" },
    // 수익 (4xxxx)
    { code: "40100", name: "상품매출", type: "REVENUE", normalBalance: "CREDIT" },
    { code: "40200", name: "제품매출", type: "REVENUE", normalBalance: "CREDIT" },
    { code: "40300", name: "용역수익", type: "REVENUE", normalBalance: "CREDIT" },
    { code: "40400", name: "이자수익", type: "REVENUE", normalBalance: "CREDIT" },
    { code: "40500", name: "임대수익", type: "REVENUE", normalBalance: "CREDIT" },
    { code: "40600", name: "외환차익", type: "REVENUE", normalBalance: "CREDIT" },
    { code: "40700", name: "유형자산처분이익", type: "REVENUE", normalBalance: "CREDIT" },
    { code: "40800", name: "잡이익", type: "REVENUE", normalBalance: "CREDIT" },
    // 비용 (5xxxx)
    { code: "50100", name: "급여", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "50200", name: "퇴직급여", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "50300", name: "복리후생비", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "50400", name: "식대", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "50500", name: "여비교통비", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "50600", name: "접대비", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "50700", name: "통신비", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "50800", name: "임차료", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "50900", name: "감가상각비", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "51000", name: "보험료", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "51100", name: "세금과공과", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "51200", name: "지급수수료", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "51300", name: "광고선전비", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "51400", name: "소모품비", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "51500", name: "수선비", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "51600", name: "외환차손", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "51700", name: "유형자산처분손실", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "51800", name: "법인세비용", type: "EXPENSE", normalBalance: "DEBIT" },
  ];

  for (const account of accounts) {
    await prisma.account.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: account.code } },
      update: { name: account.name },
      create: { ...account, tenantId: tenant.id },
    });
  }

  // ── 거래처 ──
  const vendors = [
    { bizNo: "123-45-67890", name: "삼성전자" },
    { bizNo: "234-56-78901", name: "네이버" },
    { bizNo: "345-67-89012", name: "쿠팡" },
    { bizNo: "456-78-90123", name: "CU편의점" },
    { bizNo: "567-89-01234", name: "스타벅스코리아" },
    { bizNo: "678-90-12345", name: "한국전력공사" },
    { bizNo: "789-01-23456", name: "KT" },
    { bizNo: "890-12-34567", name: "현대오피스" },
    { bizNo: "901-23-45678", name: "교보문고" },
    { bizNo: "012-34-56789", name: "배달의민족" },
  ];

  for (const v of vendors) {
    await prisma.vendor.upsert({
      where: { tenantId_bizNo: { tenantId: tenant.id, bizNo: v.bizNo } },
      update: { name: v.name },
      create: { ...v, tenantId: tenant.id },
    });
  }

  // ── 부서 ──
  const departments = [
    { code: "DP-001", name: "경영지원팀", manager: "김대표", budget: 50000000 },
    { code: "DP-002", name: "개발팀", manager: "이개발", budget: 80000000 },
    { code: "DP-003", name: "영업팀", manager: "박영업", budget: 60000000 },
    { code: "DP-004", name: "마케팅팀", manager: "최마케", budget: 40000000 },
    { code: "DP-005", name: "인사팀", manager: "정인사", budget: 30000000 },
  ];

  for (const d of departments) {
    await prisma.department.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: d.code } },
      update: { name: d.name, manager: d.manager, budget: d.budget },
      create: { ...d, tenantId: tenant.id },
    });
  }

  // ── 프로젝트 ──
  const projects = [
    { code: "PJ-001", name: "ERP 구축", status: "ACTIVE", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), manager: "이개발", budget: 120000000 },
    { code: "PJ-002", name: "홈페이지 리뉴얼", status: "ACTIVE", startDate: new Date("2026-03-01"), endDate: new Date("2026-06-30"), manager: "이개발", budget: 30000000 },
    { code: "PJ-003", name: "마케팅 캠페인 Q2", status: "ACTIVE", startDate: new Date("2026-04-01"), endDate: new Date("2026-06-30"), manager: "최마케", budget: 15000000 },
  ];

  for (const p of projects) {
    await prisma.project.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: p.code } },
      update: { name: p.name, status: p.status, manager: p.manager, budget: p.budget },
      create: { ...p, tenantId: tenant.id },
    });
  }

  // ── 품목 (원가관리/재고) ──
  const products = [
    { code: "P-001", name: "A4 용지", category: "사무용품", unit: "BOX", standardCost: 25000, safetyStock: 5 },
    { code: "P-002", name: "토너 카트리지", category: "사무용품", unit: "EA", standardCost: 85000, safetyStock: 2 },
    { code: "P-003", name: "모니터", category: "전산장비", unit: "EA", standardCost: 350000, safetyStock: 1 },
    { code: "P-004", name: "키보드", category: "전산장비", unit: "EA", standardCost: 55000, safetyStock: 3 },
    { code: "P-005", name: "명함", category: "인쇄물", unit: "BOX", standardCost: 15000, safetyStock: 10 },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: p.code } },
      update: { name: p.name, category: p.category, unit: p.unit, standardCost: p.standardCost, safetyStock: p.safetyStock },
      create: { ...p, tenantId: tenant.id },
    });
  }

  // ── 직원 ──
  const employees = [
    { employeeNo: "EMP-001", name: "김대표", department: "경영지원팀", position: "대표이사", joinDate: new Date("2020-01-02"), baseSalary: 8000000 },
    { employeeNo: "EMP-002", name: "이개발", department: "개발팀", position: "팀장", joinDate: new Date("2021-03-15"), baseSalary: 6000000 },
    { employeeNo: "EMP-003", name: "박영업", department: "영업팀", position: "팀장", joinDate: new Date("2021-06-01"), baseSalary: 5500000 },
    { employeeNo: "EMP-004", name: "최마케", department: "마케팅팀", position: "팀장", joinDate: new Date("2022-01-10"), baseSalary: 5000000 },
    { employeeNo: "EMP-005", name: "정인사", department: "인사팀", position: "팀장", joinDate: new Date("2022-04-01"), baseSalary: 5000000 },
    { employeeNo: "EMP-006", name: "한주니어", department: "개발팀", position: "사원", joinDate: new Date("2024-09-01"), baseSalary: 3500000 },
    { employeeNo: "EMP-007", name: "오신입", department: "영업팀", position: "사원", joinDate: new Date("2025-03-02"), baseSalary: 3200000 },
  ];

  for (const e of employees) {
    await prisma.employee.upsert({
      where: { tenantId_employeeNo: { tenantId: tenant.id, employeeNo: e.employeeNo } },
      update: { name: e.name, department: e.department, position: e.position, baseSalary: e.baseSalary },
      create: { ...e, tenantId: tenant.id },
    });
  }

  // ── 은행 계좌 ──
  const depositAccount = await prisma.account.findFirst({
    where: { tenantId: tenant.id, code: "10300" },
  });

  if (depositAccount) {
    const bankAccounts = [
      { bankName: "국민은행", accountNumber: "123-456-789012", accountHolder: "테스트 회사", balance: 50000000, accountId: depositAccount.id },
      { bankName: "신한은행", accountNumber: "987-654-321098", accountHolder: "테스트 회사", balance: 30000000, accountId: depositAccount.id },
    ];

    for (const ba of bankAccounts) {
      const existing = await prisma.bankAccount.findFirst({
        where: { tenantId: tenant.id, accountNumber: ba.accountNumber },
      });
      if (!existing) {
        await prisma.bankAccount.create({
          data: { ...ba, tenantId: tenant.id },
        });
      }
    }
  }

  // ── 급여 처리 (PayrollRecord, 1~3월) ──
  const RATES = {
    nationalPension: 0.045,
    healthInsurance: 0.03545,
    longTermCareRate: 0.1281,
    employmentInsurance: 0.009,
  };

  function calcIncomeTax(monthly: number): number {
    if (monthly <= 1060000) return 0;
    if (monthly <= 1500000) return Math.round((monthly - 1060000) * 0.06);
    if (monthly <= 3000000) return Math.round(26400 + (monthly - 1500000) * 0.15);
    if (monthly <= 4500000) return Math.round(251400 + (monthly - 3000000) * 0.15);
    if (monthly <= 7000000) return Math.round(476400 + (monthly - 4500000) * 0.24);
    return Math.round(1076400 + (monthly - 7000000) * 0.35);
  }

  const allEmployees = await prisma.employee.findMany({
    where: { tenantId: tenant.id, status: "ACTIVE" },
  });

  let payrollCount = 0;
  for (const emp of allEmployees) {
    const baseSalary = Number(emp.baseSalary);
    for (let month = 1; month <= 3; month++) {
      const period = `2026-${String(month).padStart(2, "0")}`;
      const grossPay = baseSalary;
      const nationalPension = Math.round(grossPay * RATES.nationalPension);
      const healthInsurance = Math.round(grossPay * RATES.healthInsurance);
      const longTermCare = Math.round(healthInsurance * RATES.longTermCareRate);
      const employmentInsurance = Math.round(grossPay * RATES.employmentInsurance);
      const incomeTax = calcIncomeTax(grossPay);
      const localIncomeTax = Math.round(incomeTax * 0.1);
      const totalDeduction = nationalPension + healthInsurance + longTermCare + employmentInsurance + incomeTax + localIncomeTax;
      const netPay = grossPay - totalDeduction;

      await prisma.payrollRecord.upsert({
        where: { employeeId_period: { employeeId: emp.id, period } },
        update: {},
        create: {
          employeeId: emp.id,
          period,
          baseSalary,
          overtimePay: 0,
          bonusPay: 0,
          grossPay,
          nationalPension,
          healthInsurance,
          longTermCare,
          employmentInsurance,
          incomeTax,
          localIncomeTax,
          totalDeduction,
          netPay,
        },
      });
      payrollCount++;
    }
  }

  // ── 결과 출력 ──
  console.log("=== Seed 완료 ===");
  console.log(`테넌트: ${tenant.name}`);
  console.log(`유저: ${admin.name}(ADMIN), ${accountant.name}(ACCOUNTANT), ${viewer.name}(VIEWER)`);
  console.log(`계정과목: ${accounts.length}건`);
  console.log(`거래처: ${vendors.length}건`);
  console.log(`부서: ${departments.length}건`);
  console.log(`프로젝트: ${projects.length}건`);
  console.log(`품목: ${products.length}건`);
  console.log(`직원: ${employees.length}건`);
  console.log(`급여 기록: ${payrollCount}건 (1~3월)`);
  console.log("");
  console.log("로그인 계정:");
  console.log("  admin@ledgerflow.dev / admin1234 (관리자)");
  console.log("  accountant@ledgerflow.dev / accountant1234 (회계담당자)");
  console.log("  viewer@ledgerflow.dev / viewer1234 (열람자)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

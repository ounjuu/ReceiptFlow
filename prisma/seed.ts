import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 테넌트 생성
  const tenant = await prisma.tenant.upsert({
    where: { id: "seed-tenant-001" },
    update: {},
    create: {
      id: "seed-tenant-001",
      name: "테스트 회사",
    },
  });

  // Admin 유저 생성
  const user = await prisma.user.upsert({
    where: { email: "admin@ledgerflow.dev" },
    update: {},
    create: {
      id: "seed-user-001",
      email: "admin@ledgerflow.dev",
      name: "관리자",
    },
  });

  // Membership 생성
  await prisma.membership.upsert({
    where: {
      userId_tenantId: {
        userId: user.id,
        tenantId: tenant.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      tenantId: tenant.id,
      role: "ADMIN",
    },
  });

  // 더존 표준 계정과목(COA) 생성
  const accounts = [
    // 자산 (1xxxx)
    { code: "10100", name: "현금", type: "ASSET", normalBalance: "DEBIT" },
    { code: "10300", name: "보통예금", type: "ASSET", normalBalance: "DEBIT" },
    { code: "10500", name: "외상매출금", type: "ASSET", normalBalance: "DEBIT" },
    { code: "10800", name: "미수금", type: "ASSET", normalBalance: "DEBIT" },
    { code: "11300", name: "상품", type: "ASSET", normalBalance: "DEBIT" },
    { code: "13100", name: "토지", type: "ASSET", normalBalance: "DEBIT" },
    { code: "13200", name: "건물", type: "ASSET", normalBalance: "DEBIT" },
    { code: "13500", name: "비품", type: "ASSET", normalBalance: "DEBIT" },
    { code: "13600", name: "감가상각누계액", type: "ASSET", normalBalance: "CREDIT" },
    // 부채 (2xxxx)
    { code: "20100", name: "외상매입금", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "20300", name: "미지급금", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "20500", name: "예수금", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "20600", name: "부가세예수금", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "20700", name: "단기차입금", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "23100", name: "장기차입금", type: "LIABILITY", normalBalance: "CREDIT" },
    // 자본 (3xxxx)
    { code: "30100", name: "자본금", type: "EQUITY", normalBalance: "CREDIT" },
    { code: "30300", name: "이익잉여금", type: "EQUITY", normalBalance: "CREDIT" },
    { code: "30500", name: "당기순이익", type: "EQUITY", normalBalance: "CREDIT" },
    // 수익 (4xxxx)
    { code: "40100", name: "상품매출", type: "REVENUE", normalBalance: "CREDIT" },
    { code: "40300", name: "용역수익", type: "REVENUE", normalBalance: "CREDIT" },
    { code: "40400", name: "이자수익", type: "REVENUE", normalBalance: "CREDIT" },
    { code: "40800", name: "잡이익", type: "REVENUE", normalBalance: "CREDIT" },
    // 비용 (5xxxx)
    { code: "50100", name: "급여", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "50300", name: "복리후생비", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "50400", name: "식대", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "50800", name: "임차료", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "50900", name: "감가상각비", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "51200", name: "지급수수료", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "51800", name: "법인세비용", type: "EXPENSE", normalBalance: "DEBIT" },
  ];

  for (const account of accounts) {
    await prisma.account.upsert({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: account.code,
        },
      },
      update: {},
      create: {
        ...account,
        tenantId: tenant.id,
      },
    });
  }

  console.log(`Tenant: ${tenant.name}`);
  console.log(`User: ${user.name} (${user.email})`);
  console.log(`계정과목 ${accounts.length}건 생성 완료`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

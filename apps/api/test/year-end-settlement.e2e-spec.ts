import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { createTestApp, signupAndGetToken } from "./setup";

describe("Year-end Settlement API (e2e)", () => {
  let app: INestApplication;
  let token: string;
  let tenantId: string;
  let employeeId: string;
  let settlementId: string;

  beforeAll(async () => {
    app = await createTestApp();

    const auth = await signupAndGetToken(
      app,
      `test-yearend-${Date.now()}@test.com`,
    );
    token = auth.token;
    tenantId = auth.tenantId;

    // 테스트용 직원 생성
    const empRes = await request(app.getHttpServer())
      .post("/payroll/employees")
      .set("Authorization", `Bearer ${token}`)
      .send({
        tenantId,
        employeeNo: `EMP-${Date.now()}`,
        name: "테스트직원",
        department: "개발팀",
        position: "사원",
        joinDate: "2024-01-01",
        baseSalary: 3000000,
      })
      .expect(201);

    employeeId = empRes.body.id;

    // 급여 처리 (2025년 1월) — 연간 급여 데이터 생성
    await request(app.getHttpServer())
      .post("/payroll/process")
      .set("Authorization", `Bearer ${token}`)
      .send({ tenantId, year: 2025, month: 1 })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  // ── POST /year-end-settlement/batch-create ──

  describe("POST /year-end-settlement/batch-create", () => {
    it("연도별 일괄 생성 성공", async () => {
      const res = await request(app.getHttpServer())
        .post("/year-end-settlement/batch-create")
        .set("Authorization", `Bearer ${token}`)
        .send({ tenantId, year: 2025 })
        .expect(201);

      expect(res.body).toHaveProperty("year", 2025);
      expect(res.body).toHaveProperty("processedCount");
      expect(res.body.processedCount).toBeGreaterThanOrEqual(1);
      expect(res.body).toHaveProperty("details");
      expect(Array.isArray(res.body.details)).toBe(true);
    });
  });

  // ── GET /year-end-settlement ──

  describe("GET /year-end-settlement", () => {
    it("연말정산 목록 조회 성공", async () => {
      const res = await request(app.getHttpServer())
        .get("/year-end-settlement")
        .query({ tenantId, year: 2025 })
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toHaveProperty("id");
      expect(res.body[0]).toHaveProperty("employeeId");
      expect(res.body[0]).toHaveProperty("year", 2025);
      expect(res.body[0]).toHaveProperty("annualGrossPay");

      settlementId = res.body[0].id;
    });

    it("인증 없이 조회 실패 (401)", async () => {
      await request(app.getHttpServer())
        .get("/year-end-settlement")
        .query({ tenantId, year: 2025 })
        .expect(401);
    });
  });

  // ── PATCH /year-end-settlement/:id ──

  describe("PATCH /year-end-settlement/:id", () => {
    it("공제 항목 수정 성공", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/year-end-settlement/${settlementId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          dependents: 3,
          dependentsUnder20: 1,
          insurancePremium: 500000,
          medicalExpense: 2000000,
          creditCardUsage: 10000000,
          debitCardUsage: 5000000,
        })
        .expect(200);

      expect(res.body).toHaveProperty("id", settlementId);
      expect(res.body.dependents).toBe(3);
      expect(res.body.dependentsUnder20).toBe(1);
    });
  });

  // ── POST /year-end-settlement/:id/calculate ──

  describe("POST /year-end-settlement/:id/calculate", () => {
    it("세액 계산 성공", async () => {
      const res = await request(app.getHttpServer())
        .post(`/year-end-settlement/${settlementId}/calculate`)
        .set("Authorization", `Bearer ${token}`)
        .expect(201);

      expect(res.body).toHaveProperty("id", settlementId);
      expect(res.body).toHaveProperty("earnedIncomeDeduction");
      expect(res.body).toHaveProperty("taxableIncome");
      expect(res.body).toHaveProperty("calculatedTax");
      expect(res.body).toHaveProperty("determinedTax");
      expect(res.body).toHaveProperty("finalTax");
      expect(res.body.status).toBe("CALCULATED");

      // 숫자 필드 타입 검증
      expect(typeof res.body.determinedTax).toBe("number");
      expect(typeof res.body.finalTax).toBe("number");
    });
  });
});

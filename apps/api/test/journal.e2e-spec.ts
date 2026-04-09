import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { createTestApp, signupAndGetToken, getAccountIdByCode } from "./setup";

describe("Journal API (e2e)", () => {
  let app: INestApplication;
  let token: string;
  let tenantId: string;
  let cashAccountId: string;   // 10100 현금
  let salesAccountId: string;  // 40100 상품매출
  let createdJournalId: string;

  // 테스트 거래처 정보
  const vendorInfo = { vendorBizNo: "123-45-67890", vendorName: "테스트거래처" };

  beforeAll(async () => {
    app = await createTestApp();

    const auth = await signupAndGetToken(
      app,
      `test-journal-${Date.now()}@test.com`,
    );
    token = auth.token;
    tenantId = auth.tenantId;

    // 테스트에 필요한 계정과목 ID 조회
    cashAccountId = await getAccountIdByCode(app, token, tenantId, "10100");
    salesAccountId = await getAccountIdByCode(app, token, tenantId, "40100");
  });

  afterAll(async () => {
    await app.close();
  });

  // ── POST /journals ──

  describe("POST /journals", () => {
    it("차대변 균형 전표 생성 성공", async () => {
      const res = await request(app.getHttpServer())
        .post("/journals")
        .set("Authorization", `Bearer ${token}`)
        .send({
          tenantId,
          date: "2025-06-01",
          description: "테스트 매출 전표",
          lines: [
            { accountId: cashAccountId, ...vendorInfo, debit: 100000, credit: 0 },
            { accountId: salesAccountId, ...vendorInfo, debit: 0, credit: 100000 },
          ],
        })
        .expect(201);

      expect(res.body).toHaveProperty("id");
      expect(res.body.description).toBe("테스트 매출 전표");
      expect(res.body.lines).toHaveLength(2);
      createdJournalId = res.body.id;
    });

    it("차대변 불균형 전표 생성 실패 (400)", async () => {
      const res = await request(app.getHttpServer())
        .post("/journals")
        .set("Authorization", `Bearer ${token}`)
        .send({
          tenantId,
          date: "2025-06-01",
          description: "불균형 전표",
          lines: [
            { accountId: cashAccountId, ...vendorInfo, debit: 100000, credit: 0 },
            { accountId: salesAccountId, ...vendorInfo, debit: 0, credit: 50000 },
          ],
        })
        .expect(400);

      expect(res.body.message).toContain("합계가 일치하지 않습니다");
    });

    it("라인 없이 전표 생성 실패 (400)", async () => {
      const res = await request(app.getHttpServer())
        .post("/journals")
        .set("Authorization", `Bearer ${token}`)
        .send({
          tenantId,
          date: "2025-06-01",
          description: "라인 없는 전표",
          lines: [],
        })
        .expect(400);

      expect(res.body.message).toContain("라인이 최소 1건");
    });

    it("인증 없이 전표 생성 실패 (401)", async () => {
      await request(app.getHttpServer())
        .post("/journals")
        .send({
          tenantId,
          date: "2025-06-01",
          description: "인증 없는 전표",
          lines: [
            { accountId: cashAccountId, ...vendorInfo, debit: 100000, credit: 0 },
            { accountId: salesAccountId, ...vendorInfo, debit: 0, credit: 100000 },
          ],
        })
        .expect(401);
    });
  });

  // ── GET /journals ──

  describe("GET /journals", () => {
    it("전표 목록 조회 성공", async () => {
      const res = await request(app.getHttpServer())
        .get("/journals")
        .query({ tenantId })
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("totalPages");
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0]).toHaveProperty("id");
      expect(res.body.data[0]).toHaveProperty("lines");
    });

    it("기간 필터 조회", async () => {
      const res = await request(app.getHttpServer())
        .get("/journals")
        .query({ tenantId, startDate: "2025-06-01", endDate: "2025-06-30" })
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty("data");
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ── PATCH /journals/:id ──

  describe("PATCH /journals/:id", () => {
    it("전표 상태 변경 (DRAFT → APPROVED)", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/journals/${createdJournalId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "APPROVED" })
        .expect(200);

      expect(res.body.status).toBe("APPROVED");
    });

    it("전표 설명 수정", async () => {
      // 수정용 전표 생성
      const createRes = await request(app.getHttpServer())
        .post("/journals")
        .set("Authorization", `Bearer ${token}`)
        .send({
          tenantId,
          date: "2025-07-01",
          description: "수정 전 전표",
          lines: [
            { accountId: cashAccountId, ...vendorInfo, debit: 50000, credit: 0 },
            { accountId: salesAccountId, ...vendorInfo, debit: 0, credit: 50000 },
          ],
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/journals/${createRes.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ description: "수정 후 전표" })
        .expect(200);

      expect(res.body.description).toBe("수정 후 전표");
    });

    it("존재하지 않는 전표 수정 실패 (404)", async () => {
      await request(app.getHttpServer())
        .patch("/journals/non-existent-id")
        .set("Authorization", `Bearer ${token}`)
        .send({ description: "실패" })
        .expect(404);
    });
  });

  // ── DELETE /journals/:id ──

  describe("DELETE /journals/:id", () => {
    it("전표 삭제 성공", async () => {
      // 삭제용 전표 생성
      const createRes = await request(app.getHttpServer())
        .post("/journals")
        .set("Authorization", `Bearer ${token}`)
        .send({
          tenantId,
          date: "2025-08-01",
          description: "삭제 테스트 전표",
          lines: [
            { accountId: cashAccountId, ...vendorInfo, debit: 30000, credit: 0 },
            { accountId: salesAccountId, ...vendorInfo, debit: 0, credit: 30000 },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/journals/${createRes.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      // 삭제된 전표 조회 시 404
      await request(app.getHttpServer())
        .get(`/journals/${createRes.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
    });

    it("존재하지 않는 전표 삭제 실패 (404)", async () => {
      await request(app.getHttpServer())
        .delete("/journals/non-existent-id")
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
    });
  });

  // ── 전표 유형 + 자동채번 ──

  describe("전표 유형 및 자동채번", () => {
    it("매입전표 생성 시 자동채번", async () => {
      const res = await request(app.getHttpServer())
        .post("/journals")
        .set("Authorization", `Bearer ${token}`)
        .send({
          tenantId,
          journalType: "PURCHASE",
          date: "2025-08-01",
          description: "매입전표 테스트",
          lines: [
            { accountId: cashAccountId, ...vendorInfo, debit: 50000, credit: 0 },
            { accountId: salesAccountId, ...vendorInfo, debit: 0, credit: 50000 },
          ],
        })
        .expect(201);

      expect(res.body.journalType).toBe("PURCHASE");
      expect(res.body.journalNumber).toMatch(/^매입-\d{8}-\d{4}$/);
    });

    it("부가세 필드 저장", async () => {
      const res = await request(app.getHttpServer())
        .post("/journals")
        .set("Authorization", `Bearer ${token}`)
        .send({
          tenantId,
          journalType: "PURCHASE",
          evidenceType: "TAX_INVOICE",
          supplyAmount: 100000,
          vatAmount: 10000,
          date: "2025-08-02",
          description: "부가세 테스트",
          lines: [
            { accountId: cashAccountId, ...vendorInfo, debit: 110000, credit: 0 },
            { accountId: salesAccountId, ...vendorInfo, debit: 0, credit: 110000 },
          ],
        })
        .expect(201);

      expect(res.body.evidenceType).toBe("TAX_INVOICE");
      expect(Number(res.body.supplyAmount)).toBe(100000);
      expect(Number(res.body.vatAmount)).toBe(10000);
    });

    it("유형별 필터", async () => {
      const res = await request(app.getHttpServer())
        .get("/journals")
        .query({ tenantId, journalType: "PURCHASE" })
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.every((j: { journalType: string }) => j.journalType === "PURCHASE")).toBe(true);
    });
  });

  // ── 페이지네이션 ──

  describe("페이지네이션", () => {
    it("page/limit 파라미터", async () => {
      const res = await request(app.getHttpServer())
        .get("/journals")
        .query({ tenantId, page: 1, limit: 2 })
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(2);
      expect(typeof res.body.total).toBe("number");
      expect(typeof res.body.totalPages).toBe("number");
    });
  });
});

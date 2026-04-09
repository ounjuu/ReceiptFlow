import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { createTestApp, signupAndGetToken } from "./setup";

describe("SummaryCode API (e2e)", () => {
  let app: INestApplication;
  let token: string;
  let tenantId: string;
  let createdId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const auth = await signupAndGetToken(app, `test-sc-${Date.now()}@test.com`);
    token = auth.token;
    tenantId = auth.tenantId;
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /summary-codes", () => {
    it("적요 코드 생성 성공", async () => {
      const res = await request(app.getHttpServer())
        .post("/summary-codes")
        .set("Authorization", `Bearer ${token}`)
        .send({ tenantId, code: "T01", description: "사무용품 구매", category: "GENERAL" })
        .expect(201);

      expect(res.body.code).toBe("T01");
      expect(res.body.description).toBe("사무용품 구매");
      expect(res.body.category).toBe("GENERAL");
      createdId = res.body.id;
    });

    it("중복 코드 생성 실패 (400)", async () => {
      await request(app.getHttpServer())
        .post("/summary-codes")
        .set("Authorization", `Bearer ${token}`)
        .send({ tenantId, code: "T01", description: "중복", category: "GENERAL" })
        .expect(400);
    });
  });

  describe("GET /summary-codes", () => {
    it("목록 조회", async () => {
      const res = await request(app.getHttpServer())
        .get("/summary-codes")
        .query({ tenantId })
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it("카테고리 필터", async () => {
      // PURCHASE 카테고리 추가
      await request(app.getHttpServer())
        .post("/summary-codes")
        .set("Authorization", `Bearer ${token}`)
        .send({ tenantId, code: "P01", description: "원자재 매입", category: "PURCHASE" })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get("/summary-codes")
        .query({ tenantId, category: "PURCHASE" })
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.every((c: { category: string }) => c.category === "PURCHASE")).toBe(true);
    });
  });

  describe("GET /summary-codes/search", () => {
    it("코드로 검색", async () => {
      const res = await request(app.getHttpServer())
        .get("/summary-codes/search")
        .query({ tenantId, q: "T01" })
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].code).toBe("T01");
    });

    it("내용으로 검색", async () => {
      const res = await request(app.getHttpServer())
        .get("/summary-codes/search")
        .query({ tenantId, q: "사무용품" })
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("PATCH /summary-codes/:id", () => {
    it("적요 코드 수정", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/summary-codes/${createdId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ description: "사무용품 구매 (수정)" })
        .expect(200);

      expect(res.body.description).toBe("사무용품 구매 (수정)");
    });
  });

  describe("DELETE /summary-codes/:id", () => {
    it("적요 코드 삭제", async () => {
      await request(app.getHttpServer())
        .delete(`/summary-codes/${createdId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      // 삭제 확인
      const res = await request(app.getHttpServer())
        .get("/summary-codes")
        .query({ tenantId })
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.find((c: { id: string }) => c.id === createdId)).toBeUndefined();
    });
  });
});

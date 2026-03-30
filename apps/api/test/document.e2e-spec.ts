import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { createTestApp, signupAndGetToken } from "./setup";

describe("Document API (e2e)", () => {
  let app: INestApplication;
  let token: string;
  let tenantId: string;
  let createdDocumentId: string;

  beforeAll(async () => {
    app = await createTestApp();

    const auth = await signupAndGetToken(
      app,
      `test-document-${Date.now()}@test.com`,
    );
    token = auth.token;
    tenantId = auth.tenantId;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── POST /documents/upload ──

  describe("POST /documents/upload", () => {
    it("이미지 업로드 성공", async () => {
      // 작은 테스트 PNG 버퍼 (1x1 투명 픽셀)
      const pngBuffer = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64",
      );

      const res = await request(app.getHttpServer())
        .post("/documents/upload")
        .set("Authorization", `Bearer ${token}`)
        .field("tenantId", tenantId)
        .attach("file", pngBuffer, "test-receipt.png")
        .expect(201);

      expect(res.body).toHaveProperty("document");
      expect(res.body.document).toHaveProperty("id");
      expect(res.body.document.imageUrl).toContain("/uploads/");
      expect(res.body.document.tenantId).toBe(tenantId);
      createdDocumentId = res.body.document.id;
    });

    it("인증 없이 업로드 실패 (401)", async () => {
      const pngBuffer = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64",
      );

      await request(app.getHttpServer())
        .post("/documents/upload")
        .field("tenantId", tenantId)
        .attach("file", pngBuffer, "test-receipt.png")
        .expect(401);
    });
  });

  // ── GET /documents ──

  describe("GET /documents", () => {
    it("문서 목록 조회 성공", async () => {
      const res = await request(app.getHttpServer())
        .get("/documents")
        .query({ tenantId })
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toHaveProperty("id");
      expect(res.body[0]).toHaveProperty("imageUrl");
    });

    it("인증 없이 목록 조회 실패 (401)", async () => {
      await request(app.getHttpServer())
        .get("/documents")
        .query({ tenantId })
        .expect(401);
    });
  });

  // ── PATCH /documents/:id ──

  describe("PATCH /documents/:id", () => {
    it("문서 정보 수정 성공", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/documents/${createdDocumentId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          vendorName: "수정된 거래처",
          totalAmount: 55000,
        })
        .expect(200);

      expect(res.body.vendorName).toBe("수정된 거래처");
      expect(Number(res.body.totalAmount)).toBe(55000);
    });

    it("존재하지 않는 문서 수정 실패 (404)", async () => {
      await request(app.getHttpServer())
        .patch("/documents/non-existent-id")
        .set("Authorization", `Bearer ${token}`)
        .send({ vendorName: "실패" })
        .expect(404);
    });
  });

  // ── DELETE /documents/:id ──

  describe("DELETE /documents/:id", () => {
    it("문서 삭제 성공", async () => {
      // 삭제용 문서 업로드
      const pngBuffer = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64",
      );

      const uploadRes = await request(app.getHttpServer())
        .post("/documents/upload")
        .set("Authorization", `Bearer ${token}`)
        .field("tenantId", tenantId)
        .attach("file", pngBuffer, "delete-test.png")
        .expect(201);

      const deleteId = uploadRes.body.document.id;

      await request(app.getHttpServer())
        .delete(`/documents/${deleteId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      // 삭제된 문서 조회 시 404
      await request(app.getHttpServer())
        .get(`/documents/${deleteId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
    });

    it("존재하지 않는 문서 삭제 실패 (404)", async () => {
      await request(app.getHttpServer())
        .delete("/documents/non-existent-id")
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
    });
  });
});

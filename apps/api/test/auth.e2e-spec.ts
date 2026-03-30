import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { createTestApp, signupAndGetToken } from "./setup";

describe("Auth API (e2e)", () => {
  let app: INestApplication;
  const testEmail = `test-auth-${Date.now()}@test.com`;
  const testPassword = "test1234";
  const testName = "인증테스트";
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── POST /auth/signup ──

  describe("POST /auth/signup", () => {
    it("회원가입 성공", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/signup")
        .send({ email: testEmail, password: testPassword, name: testName })
        .expect(201);

      expect(res.body).toHaveProperty("token");
      expect(res.body.user).toHaveProperty("id");
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.user.name).toBe(testName);
      expect(res.body.user.memberships).toHaveLength(1);
      expect(res.body.user.memberships[0]).toHaveProperty("tenantId");
      expect(res.body.user.memberships[0].role).toBe("ADMIN");

      token = res.body.token;
    });

    it("중복 이메일 회원가입 실패 (409)", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/signup")
        .send({ email: testEmail, password: testPassword, name: testName })
        .expect(409);

      expect(res.body.message).toContain("이미 사용 중인 이메일");
    });
  });

  // ── POST /auth/login ──

  describe("POST /auth/login", () => {
    it("로그인 성공", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: testEmail, password: testPassword })
        .expect(201);

      expect(res.body).toHaveProperty("token");
      expect(res.body.user.email).toBe(testEmail);
    });

    it("잘못된 비밀번호 (401)", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: testEmail, password: "wrongpassword" })
        .expect(401);

      expect(res.body.message).toContain("이메일 또는 비밀번호");
    });

    it("존재하지 않는 이메일 (401)", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: "nonexistent@test.com", password: testPassword })
        .expect(401);

      expect(res.body.message).toContain("이메일 또는 비밀번호");
    });
  });

  // ── GET /auth/me ──

  describe("GET /auth/me", () => {
    it("토큰으로 내 정보 조회 성공", async () => {
      const res = await request(app.getHttpServer())
        .get("/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty("id");
      expect(res.body.email).toBe(testEmail);
      expect(res.body.name).toBe(testName);
      expect(res.body.memberships).toHaveLength(1);
    });

    it("토큰 없이 요청 시 401", async () => {
      await request(app.getHttpServer())
        .get("/auth/me")
        .expect(401);
    });

    it("잘못된 토큰으로 요청 시 401", async () => {
      await request(app.getHttpServer())
        .get("/auth/me")
        .set("Authorization", "Bearer invalid-token-here")
        .expect(401);
    });
  });
});

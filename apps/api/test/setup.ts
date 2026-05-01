import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * 테스트용 NestJS 앱을 생성한다.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();
  // DB 커넥션 풀 안정화 대기
  await new Promise((r) => setTimeout(r, 100));
  return app;
}

/**
 * 회원가입 후 토큰과 tenantId를 반환한다.
 */
export async function signupAndGetToken(
  app: INestApplication,
  email: string,
  password: string = "test1234",
  name: string = "테스트유저",
): Promise<{ token: string; tenantId: string; userId: string }> {
  const res = await request(app.getHttpServer())
    .post("/auth/signup")
    .send({ email, password, name })
    .expect(201);

  return {
    token: res.body.token,
    tenantId: res.body.user.memberships[0].tenantId,
    userId: res.body.user.id,
  };
}

/**
 * 로그인 후 토큰을 반환한다.
 */
export async function loginAndGetToken(
  app: INestApplication,
  email: string,
  password: string = "test1234",
): Promise<{ token: string; tenantId: string; userId: string }> {
  const res = await request(app.getHttpServer())
    .post("/auth/login")
    .send({ email, password })
    .expect(201);

  return {
    token: res.body.token,
    tenantId: res.body.user.memberships[0].tenantId,
    userId: res.body.user.id,
  };
}

/**
 * 테넌트의 계정과목 ID를 코드로 조회한다.
 */
export async function getAccountIdByCode(
  app: INestApplication,
  token: string,
  tenantId: string,
  code: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .get("/accounts")
    .query({ tenantId })
    .set("Authorization", `Bearer ${token}`)
    .expect(200);

  const account = res.body.find((a: { code: string }) => a.code === code);
  if (!account) {
    throw new Error(`계정코드 ${code}를 찾을 수 없습니다`);
  }
  return account.id;
}

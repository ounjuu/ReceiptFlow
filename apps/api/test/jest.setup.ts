// e2e 테스트용 전역 환경변수 기본값.
// 누락된 필수 env(JWT_SECRET 등)에 테스트용 더미 값을 채워 부팅을 통과시킨다.
// prod에서는 jwt.strategy.ts의 검증이 그대로 동작한다.
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-not-for-prod";

import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const helmet = require("helmet");
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // 보안 HTTP 헤더 (XSS, clickjacking 등 기본 방어).
  // contentSecurityPolicy는 API 응답에 불필요해 비활성화 (정적 자산은 별도)
  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors();
  app.useGlobalFilters(new HttpExceptionFilter());
  // 업로드 파일 정적 서빙
  app.useStaticAssets(join(__dirname, "..", "uploads"), { prefix: "/uploads" });
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();

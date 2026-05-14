import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
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
  // DTO 입력 검증 (class-validator). transform: true → @Body 인자 클래스 인스턴스로 변환
  // whitelist: 정의되지 않은 필드 제거. 일단 비활성 (기존 DTO에 모든 필드 데코레이터 안 붙은 상태라 안전 회피)
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      forbidNonWhitelisted: false,
      whitelist: false,
    }),
  );
  // 업로드 파일 정적 서빙
  app.useStaticAssets(join(__dirname, "..", "uploads"), { prefix: "/uploads" });

  // Swagger 자동 문서 (http://localhost:3001/api-docs)
  const swaggerConfig = new DocumentBuilder()
    .setTitle("LedgerFlow API")
    .setDescription("AI 기반 영수증 자동 처리 및 전표 자동 생성 ERP API")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api-docs", app, swaggerDoc);

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();

import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();
  // 업로드 파일 정적 서빙
  app.useStaticAssets(join(__dirname, "..", "uploads"), { prefix: "/uploads" });
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();

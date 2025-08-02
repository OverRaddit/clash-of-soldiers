import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // CORS 설정 - 프로덕션과 개발 환경 모두 지원
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://clash-of-soldiers.vercel.app',
      /^https:\/\/.*\.vercel\.app$/
    ],
    credentials: true,
  });

  // 글로벌 validation pipe
  app.useGlobalPipes(new ValidationPipe());

  // Railway는 PORT 환경변수를 제공
  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`토이배틀 백엔드 서버가 포트 ${port}에서 실행중입니다.`);
}
bootstrap();
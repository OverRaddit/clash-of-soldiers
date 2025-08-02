import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // CORS 설정
  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });

  // 글로벌 validation pipe
  app.useGlobalPipes(new ValidationPipe());

  await app.listen(3001);
  console.log('토이배틀 백엔드 서버가 포트 3001에서 실행중입니다.');
}
bootstrap();
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';
import { AppModule } from './app.module';
import { SessionGuard } from './modules/auth/session.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? `http://localhost:${process.env.WEB_PORT ?? 5173}`,
    credentials: false,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalGuards(new SessionGuard());

  const port = Number(process.env.API_PORT ?? process.env.PORT);
  if (!port) {
    throw new Error('Missing API_PORT in environment');
  }
  await app.listen(port);
}

void bootstrap();

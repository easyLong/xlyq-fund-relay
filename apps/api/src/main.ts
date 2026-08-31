import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';
import 'reflect-metadata';
import { AppModule } from './app.module';
import { SessionGuard } from './modules/auth/session.guard';
import { ensureUploadRoot } from './modules/uploads/upload-paths';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(ensureUploadRoot(), {
    prefix: '/api/v1/upload-files/',
    index: false,
  });
  app.use(json({ limit: '12mb' }));
  // H5 screenshots are compressed on the client and submitted as data URLs.
  // Keep enough room for three images while still rejecting unbounded payloads.
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

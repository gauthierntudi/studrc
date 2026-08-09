import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  const config = app.get(ConfigService);
  const appUrl = config.get<string>('APP_URL', 'http://localhost:3000');

  // Derrière nginx : IP réelle pour throttling / logs (@Ip())
  app.set('trust proxy', 1);

  // Articles migrés : chapeau + HTML de sections peuvent dépasser le défaut Express (100kb).
  app.useBodyParser('json', { limit: '5mb' });
  app.useBodyParser('urlencoded', { limit: '5mb', extended: true });

  app.use(cookieParser());

  app.enableCors({
    origin: [appUrl, 'http://localhost:3000'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api');

  const port = Number(config.get('API_PORT') ?? 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}/api`);
}

bootstrap();

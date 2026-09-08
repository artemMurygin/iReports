import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ZodValidationPipe } from 'nestjs-zod';
import { DomainExceptionFilter } from '@/shared/exceptions';
import { setupSwagger } from '@/config/swagger.config';
import { isDevAuthBypassEnabled } from '@/shared/config/dev-auth-bypass';

async function bootstrap() {
    if (isDevAuthBypassEnabled()) {
        console.warn(
            '⚠️  AUTH_DISABLED=true — авторизация ОТКЛЮЧЕНА, только для локальной разработки',
        );
    }

    const app = await NestFactory.create(AppModule, { bodyParser: false });
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));
    // Нужен для доставки session_id через cookie на standalone-сайте/iOS
    // (add-bitrix24-auth-and-rbac, SessionAuthGuard/CSRF-guard читают
    // req.cookies) — iframe-контекст использует Authorization-заголовок и
    // cookie не требует.
    app.use(cookieParser());
    app.enableCors({
        origin: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        credentials: true,
    });
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalFilters(new DomainExceptionFilter());

    setupSwagger(app);

    await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();

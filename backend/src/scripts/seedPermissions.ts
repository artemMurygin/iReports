import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PermissionsCatalogSeeder } from '../modules/roles/infrastructure/permissions-catalog.seeder';

// Наполняет каталог Permission из типизированных реестров модулей-владельцев
// (design.md, Decision 12) — запускается отдельным шагом деплоя (`npm run
// seed:permissions`), НЕ при каждом старте приложения. Идемпотентно:
// повторный запуск не создаёт дублей и не трогает права других модулей.
async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);

    try {
        const seeder = app.get(PermissionsCatalogSeeder);
        await seeder.seed();
        console.log('Каталог permission-кодов синхронизирован с реестрами модулей.');
        await app.close();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

void bootstrap();

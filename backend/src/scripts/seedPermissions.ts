import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PermissionsCatalogSeeder } from '../modules/roles/infrastructure/permissions-catalog.seeder';
import { AdministratorRoleSeeder } from '../modules/roles/infrastructure/administrator-role.seeder';

// Наполняет каталог Permission из типизированных реестров модулей-владельцев
// (design.md, Decision 12), затем сидирует системную роль Administrator со
// ВСЕМИ правами получившегося каталога (design.md, Decision 9 + Migration
// Plan шаг 3 — используется bootstrap первого администратора, раздел 11
// tasks.md) — запускается отдельным шагом деплоя (`npm run
// seed:permissions`), НЕ при каждом старте приложения. Оба шага идемпотентны:
// повторный запуск не создаёт дублей и обновляет права Administrator до
// полного текущего каталога.
async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);

    try {
        const permissionsCatalogSeeder = app.get(PermissionsCatalogSeeder);
        await permissionsCatalogSeeder.seed();
        console.log(
            'Каталог permission-кодов синхронизирован с реестрами модулей.',
        );

        const administratorRoleSeeder = app.get(AdministratorRoleSeeder);
        await administratorRoleSeeder.seed();
        console.log(
            'Системная роль Administrator синхронизирована с текущим каталогом прав.',
        );

        await app.close();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

void bootstrap();

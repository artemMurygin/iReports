import 'dotenv/config';
import { randomUUID } from 'crypto';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DatabaseService } from '../infrustructure/database/database.service';
import { planEmployeeIdentityMigration } from '../modules/employee-identity/infrastructure/migration/plan-employee-identity-migration';

// Разовый перенос BitrixEmployee.roappId/moySkladId/roappOnlineName в
// EmployeeIdentity (Фаза 2, см. docs/payroll/plan-payroll-calculation.md).
// Безопасен для повторного запуска — planEmployeeIdentityMigration не
// создаёт связь, которая уже есть в БД.
async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const db = app.get(DatabaseService);

    try {
        const employees = await db.bitrixEmployee.findMany({
            select: {
                id: true,
                roappId: true,
                moySkladId: true,
                roappOnlineName: true,
            },
        });
        const existing = await db.employeeIdentity.findMany({
            select: { system: true, identifierType: true, externalId: true },
        });

        const plan = planEmployeeIdentityMigration(employees, existing);

        if (plan.length === 0) {
            console.log('Переносить нечего — все связи уже перенесены.');
        } else {
            await db.employeeIdentity.createMany({
                data: plan.map((item) => ({
                    id: randomUUID(),
                    bitrixEmployeeId: item.bitrixEmployeeId,
                    system: item.system,
                    identifierType: item.identifierType,
                    externalId: item.externalId,
                })),
            });
            console.log(`Перенесено связей: ${plan.length}`);
        }

        await app.close();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

void bootstrap();

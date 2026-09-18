import 'dotenv/config';
import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from '../infrustructure/database/database.module';
import { DatabaseService } from '../infrustructure/database/database.service';
import { ApiKey } from '../modules/session/domain/value-objects/api-key.value-object';

// add-employee-api-key-auth, design.md Decision 4 / Migration Plan шаг 4 —
// одноразовый бэкфилл apiKeyHash для сотрудников, чья строка BitrixEmployee
// уже существовала в базе ДО выката этого изменения (upsertEmployeeRecord
// генерирует apiKeyHash только в ветке create — см.
// bitrix-sync.service.ts:upsertEmployeeRecord, поэтому для них update-ветка
// никогда его не заполнит). Идемпотентен: выбирает только строки с
// apiKeyHash IS NULL, повторный запуск не меняет уже заполненные значения.
//
// Запуск: npm run build && node dist/src/scripts/backfillEmployeeApiKeyHashOnce.js
@Module({
    imports: [EventEmitterModule.forRoot(), DatabaseModule],
})
class BackfillEmployeeApiKeyHashOnceModule {}

async function main() {
    const moduleRef = await Test.createTestingModule({
        imports: [BackfillEmployeeApiKeyHashOnceModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    const db = app.get(DatabaseService);

    const employeesWithoutKey = await db.bitrixEmployee.findMany({
        where: { apiKeyHash: null },
        select: { id: true },
    });

    for (const employee of employeesWithoutKey) {
        // Обновляем по одному, а не batch-updateMany с общим значением —
        // каждому сотруднику нужен свой уникальный хэш (apiKeyHash —
        // @unique в схеме).
        const { hash } = ApiKey.generate();
        await db.bitrixEmployee.update({
            where: { id: employee.id },
            data: { apiKeyHash: hash },
        });
    }

    console.log(
        `OK: apiKeyHash заполнен для ${employeesWithoutKey.length} сотрудников`,
    );

    await app.close();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

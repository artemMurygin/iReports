// Разовый перенос планов продаж (SalesPlanTemplate/SalesPlan), настроенных
// вручную в dev, в prod при выкатке релиза. По аналогии с
// transfer-config-to-prod.ts: идемпотентный upsert, ничего в целевой БД не
// удаляется.
//
// Предпосылки:
//   - dev и prod синхронизированы с ОДНИМ И ТЕМ ЖЕ Bitrix24-порталом, поэтому
//     departmentId (натуральный ключ обеих таблиц) совпадает в обеих БД —
//     отделы переотображать не нужно.
//   - на prod уже прогнан sync отделов Bitrix24 (BitrixDepartment существуют)
//     — иначе строки с departmentId, которого нет в prod, переносить некуда.
//   - id обеих таблиц — независимо сгенерированный UUID в каждой БД, поэтому
//     сопоставление идёт по натуральному уникальному ключу
//     (direction, departmentId, categoryId[, period]), а не по id.
//
// Запуск (по умолчанию dry-run, ничего не пишет):
//   SOURCE_DATABASE_URL=postgres://...dev  \
//   TARGET_DATABASE_URL=postgres://...prod \
//   npm run transfer:sales-plans-to-prod
//
// Запись в целевую БД — только с явным флагом:
//   npm run transfer:sales-plans-to-prod -- --commit
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../prisma/generated/prisma/schema/client';

const COMMIT = process.argv.includes('--commit');

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Не задана переменная окружения ${name}`);
    }
    return value;
}

const sourceUrl = requireEnv('SOURCE_DATABASE_URL');
const targetUrl = requireEnv('TARGET_DATABASE_URL');

if (sourceUrl === targetUrl) {
    throw new Error(
        'SOURCE_DATABASE_URL и TARGET_DATABASE_URL совпадают — похоже на ошибку конфигурации, прерываю.',
    );
}

const source = new PrismaClient({
    adapter: new PrismaPg({ connectionString: sourceUrl }),
});
const target = new PrismaClient({
    adapter: new PrismaPg({ connectionString: targetUrl }),
});

const summary = {
    salesPlanTemplates: {
        created: 0,
        updated: 0,
        skippedMissingDepartment: [] as number[],
    },
    salesPlans: {
        created: 0,
        updated: 0,
        skippedMissingDepartment: [] as number[],
    },
};

async function transferSalesPlanTemplates() {
    const rows = await source.salesPlanTemplate.findMany();
    for (const row of rows) {
        const prodDepartment = await target.bitrixDepartment.findUnique({
            where: { id: row.departmentId },
        });
        if (!prodDepartment) {
            summary.salesPlanTemplates.skippedMissingDepartment.push(
                row.departmentId,
            );
            continue;
        }

        const existing = await target.salesPlanTemplate.findUnique({
            where: {
                direction_departmentId_categoryId: {
                    direction: row.direction,
                    departmentId: row.departmentId,
                    categoryId: row.categoryId,
                },
            },
        });
        if (existing) {
            summary.salesPlanTemplates.updated++;
        } else {
            summary.salesPlanTemplates.created++;
        }
        if (!COMMIT) continue;

        await target.salesPlanTemplate.upsert({
            where: {
                direction_departmentId_categoryId: {
                    direction: row.direction,
                    departmentId: row.departmentId,
                    categoryId: row.categoryId,
                },
            },
            update: {
                turnover: row.turnover,
                margin: row.margin,
                orderTypeIds: row.orderTypeIds,
                growthPercent: row.growthPercent,
                sortOrder: row.sortOrder,
            },
            create: {
                id: existing?.id ?? randomUUID(),
                direction: row.direction,
                departmentId: row.departmentId,
                categoryId: row.categoryId,
                turnover: row.turnover,
                margin: row.margin,
                orderTypeIds: row.orderTypeIds,
                growthPercent: row.growthPercent,
                sortOrder: row.sortOrder,
            },
        });
    }
    console.log(`sales_plan_templates: ${rows.length} строк в источнике`);
}

async function transferSalesPlans() {
    const rows = await source.salesPlan.findMany();
    for (const row of rows) {
        const prodDepartment = await target.bitrixDepartment.findUnique({
            where: { id: row.departmentId },
        });
        if (!prodDepartment) {
            summary.salesPlans.skippedMissingDepartment.push(
                row.departmentId,
            );
            continue;
        }

        const existing = await target.salesPlan.findUnique({
            where: {
                direction_departmentId_categoryId_period: {
                    direction: row.direction,
                    departmentId: row.departmentId,
                    categoryId: row.categoryId,
                    period: row.period,
                },
            },
        });
        if (existing) {
            summary.salesPlans.updated++;
        } else {
            summary.salesPlans.created++;
        }
        if (!COMMIT) continue;

        await target.salesPlan.upsert({
            where: {
                direction_departmentId_categoryId_period: {
                    direction: row.direction,
                    departmentId: row.departmentId,
                    categoryId: row.categoryId,
                    period: row.period,
                },
            },
            update: {
                turnover: row.turnover,
                margin: row.margin,
                orderTypeIds: row.orderTypeIds,
                source: row.source,
                status: row.status,
                approvedBy: row.approvedBy,
                approvedAt: row.approvedAt,
            },
            create: {
                id: existing?.id ?? randomUUID(),
                direction: row.direction,
                departmentId: row.departmentId,
                categoryId: row.categoryId,
                period: row.period,
                turnover: row.turnover,
                margin: row.margin,
                orderTypeIds: row.orderTypeIds,
                source: row.source,
                status: row.status,
                approvedBy: row.approvedBy,
                approvedAt: row.approvedAt,
            },
        });
    }
    console.log(`sales_plans: ${rows.length} строк в источнике`);
}

async function main() {
    console.log(
        COMMIT
            ? 'Режим записи (--commit): изменения будут применены к TARGET_DATABASE_URL.'
            : 'Dry-run (флаг --commit не передан): только подсчёт, ничего не пишу.',
    );

    await transferSalesPlanTemplates();
    await transferSalesPlans();

    console.log('\nИтог:', JSON.stringify(summary, null, 2));

    if (summary.salesPlanTemplates.skippedMissingDepartment.length > 0) {
        console.warn(
            '\nВНИМАНИЕ: часть шаблонов планов продаж ссылается на отделы, которых нет в prod ' +
                '(ещё не синхронизированы из Bitrix24):',
            [...new Set(summary.salesPlanTemplates.skippedMissingDepartment)],
        );
    }
    if (summary.salesPlans.skippedMissingDepartment.length > 0) {
        console.warn(
            '\nВНИМАНИЕ: часть строк планов продаж ссылается на отделы, которых нет в prod ' +
                '(ещё не синхронизированы из Bitrix24):',
            [...new Set(summary.salesPlans.skippedMissingDepartment)],
        );
    }
    if (!COMMIT) {
        console.log(
            '\nЭто был dry-run. Проверьте счётчики выше и перезапустите с --commit, чтобы записать в целевую БД.',
        );
    }
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await source.$disconnect();
        await target.$disconnect();
    });

// Точка входа `prisma db seed` (см. migrations.seed в prisma.config.ts).
// Накатывает анонимизированные фикстуры из prisma/seed-data/ (см.
// export-from-live-db.ts, где они генерируются) в ТЕКУЩУЮ БД (DATABASE_URL)
// через Prisma Client, в порядке, не нарушающем внешние ключи.
//
// ДЕСТРУКТИВНО: перед загрузкой полностью очищает все сидируемые таблицы
// (TRUNCATE ... CASCADE). Предназначен для чистой/demo-БД (например, только
// что поднятого docker-compose), а не для БД с боевыми данными — поэтому
// требует интерактивного подтверждения (см. confirmDestructiveSeed ниже);
// SEED_FORCE=1 пропускает подтверждение для неинтерактивных сценариев
// (docker entrypoint, CI на заведомо пустой БД).
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline/promises';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../prisma/generated/prisma/schema/client';

// См. комментарий в export-from-live-db.ts — путь от cwd (npm run из
// backend/), не от __dirname.
const SEED_DATA_DIR = join(process.cwd(), 'prisma', 'seed-data');

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Все таблицы, которые накатывает этот сид (bitrix_installations
// сознательно исключена — см. export-from-live-db.ts). Порядок здесь не
// важен: TRUNCATE ... CASCADE снимает и сбрасывает все таблицы разом,
// невзирая на внешние ключи.
const SEEDED_TABLES = [
    'bitrix_departments',
    'bitrix_enum_values',
    'bitrix_stages',
    'bitrix_point_of_contacts',
    'bitrix_device_types',
    'bitrix_lead_sources',
    'roapp_order_types',
    'roapp_marketing_sources',
    'roapp_order_statuses',
    'roapp_employees',
    'moy_sklad_employees',
    'bitrix_employees',
    'bitrix_deals',
    'employee_identities',
    'roapp_product_categories',
    'roapp_products',
    'roapp_service_categories',
    'roapp_service',
    'roapp_orders',
    'roapp_products_orders',
    'roapp_service_orders',
    'moy_sklad_product_folders',
    'moy_sklad_products',
    'moy_sklad_services',
    'moy_sklad_demands',
    'moy_sklad_demand_positions',
    'domain_sync_status',
    'accounting_periods',
    'accounting_period_snapshots',
    'accounting_calculation_cache',
    'balance_transactions',
    'erp_cash_documents',
    'salary_accruals',
    'salary_accrual_lines',
    'salary_accrual_line_adjustments',
    'motivation_schemas',
    'salary_rules',
    'work_schedule_entries',
    'sales_plan_templates',
    'sales_plans',
];

function readSeedFile(name: string): Record<string, unknown>[] {
    try {
        return JSON.parse(
            readFileSync(join(SEED_DATA_DIR, `${name}.json`), 'utf-8'),
        ) as Record<string, unknown>[];
    } catch {
        return [];
    }
}

// Один и тот же generic-загрузчик прогоняет данные через 41 разный Prisma
// delegate (каждый со своим строгим *CreateManyInput) — конкретная форма
// строки известна только export-скрипту, который её и сгенерировал, а не
// этому файлу, поэтому здесь delegate/данные намеренно `any`, а не попытка
// подобрать общий структурный тип под все модели сразу.
interface CreateManyDelegate {
    createMany: (args: {
        data: any[];
        skipDuplicates?: boolean;
    }) => Promise<unknown>;
}

async function insertMany(name: string, delegate: CreateManyDelegate) {
    const rows = readSeedFile(name);
    if (rows.length === 0) return;
    await delegate.createMany({ data: rows, skipDuplicates: true });
    console.log(`  ${name}: ${rows.length}`);
}

interface TreeDelegate extends CreateManyDelegate {
    update: (args: {
        where: { id: any };
        data: Record<string, unknown>;
    }) => Promise<unknown>;
}

// Дерево с self-relation (parentId): родитель может идти в файле после
// потомка, поэтому вставляем все строки без parentId, а сам parentId
// проставляем вторым проходом — иначе внешний ключ на ещё не вставленного
// родителя не пройдёт.
async function insertTree(
    name: string,
    delegate: TreeDelegate,
    parentField: string,
) {
    const rows = readSeedFile(name);
    if (rows.length === 0) return;
    await delegate.createMany({
        data: rows.map((row) => ({ ...row, [parentField]: null })),
        skipDuplicates: true,
    });
    for (const row of rows) {
        if (row[parentField] != null) {
            await delegate.update({
                where: { id: row.id as string | number },
                data: { [parentField]: row[parentField] },
            });
        }
    }
    console.log(`  ${name}: ${rows.length}`);
}

// Маскирует пароль в connection string перед выводом в консоль — этот
// скрипт печатает, в какую БД собирается стереть данные, а секрет из .env
// в лог попадать не должен.
function redactDatabaseUrl(url: string): string {
    try {
        const parsed = new URL(url);
        if (parsed.password) parsed.password = '***';
        return parsed.toString();
    } catch {
        return '<не удалось разобрать DATABASE_URL>';
    }
}

// Подтверждение перед TRUNCATE. По умолчанию требует интерактивного ввода
// (защита от случайного запуска на БД с боевыми синхронизированными
// данными — см. предупреждение в шапке файла). Для неинтерактивных
// сценариев (первый подъём docker-compose на заведомо пустой БД, CI) —
// SEED_FORCE=1 пропускает подтверждение.
async function confirmDestructiveSeed(): Promise<void> {
    if (process.env.SEED_FORCE === '1') return;

    const target = redactDatabaseUrl(process.env.DATABASE_URL ?? '');
    console.warn(
        `\nВНИМАНИЕ: сейчас будут ПОЛНОСТЬЮ УДАЛЕНЫ (TRUNCATE ... CASCADE) ${SEEDED_TABLES.length} таблиц в БД:\n  ${target}\n` +
            'Если это не чистая/demo-БД, а БД с боевыми синхронизированными данными — прервите выполнение (Ctrl+C).\n',
    );

    if (!process.stdin.isTTY) {
        console.error(
            'stdin не интерактивен — подтверждение недоступно. Запустите с SEED_FORCE=1, ' +
                'только если точно уверены, что это чистая/demo-БД.',
        );
        process.exit(1);
    }

    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const answer = await rl.question('Введите "yes" для продолжения: ');
    rl.close();
    if (answer.trim().toLowerCase() !== 'yes') {
        console.log('Отменено.');
        process.exit(1);
    }
}

async function main() {
    await confirmDestructiveSeed();

    console.log('Очищаю таблицы перед загрузкой сид-данных...');
    await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE ${SEEDED_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`,
    );

    console.log('Загружаю сид-данные...');

    await insertMany('bitrix_departments', prisma.bitrixDepartment);
    await insertMany('bitrix_enum_values', prisma.bitrixEnumValue);
    await insertMany('bitrix_stages', prisma.bitrixStage);
    await insertMany('bitrix_point_of_contacts', prisma.bitrixPointOfContact);
    await insertMany('bitrix_device_types', prisma.bitrixDeviceTypes);
    await insertMany('bitrix_lead_sources', prisma.bitrixLeadSources);

    await insertMany('roapp_order_types', prisma.roappOrderType);
    await insertMany('roapp_marketing_sources', prisma.roappMarketingSource);
    await insertMany('roapp_order_statuses', prisma.roappOrderStatus);

    await insertMany('roapp_employees', prisma.roappEmployee);
    await insertMany('moy_sklad_employees', prisma.moySkladEmployee);
    await insertMany('bitrix_employees', prisma.bitrixEmployee);
    await insertMany('bitrix_deals', prisma.bitrixDeal);
    await insertMany('employee_identities', prisma.employeeIdentity);

    await insertTree(
        'roapp_product_categories',
        prisma.roappProductCategory,
        'parentId',
    );
    await insertMany('roapp_products', prisma.roappProduct);
    await insertTree(
        'roapp_service_categories',
        prisma.roappServiceCategory,
        'parentId',
    );
    await insertMany('roapp_service', prisma.roappService);

    await insertMany('roapp_orders', prisma.roappOrder);
    await insertMany('roapp_products_orders', prisma.roappProductsOrder);
    await insertMany('roapp_service_orders', prisma.roappServiceOrder);

    await insertTree(
        'moy_sklad_product_folders',
        prisma.moySkladProductFolder,
        'parentId',
    );
    await insertMany('moy_sklad_products', prisma.moySkladProduct);
    await insertMany('moy_sklad_services', prisma.moySkladService);
    await insertMany('moy_sklad_demands', prisma.moySkladDemand);
    await insertMany(
        'moy_sklad_demand_positions',
        prisma.moySkladDemandPosition,
    );

    await insertMany('domain_sync_status', prisma.domainSyncStatus);
    await insertMany('accounting_periods', prisma.accountingPeriod);
    await insertMany(
        'accounting_period_snapshots',
        prisma.accountingPeriodSnapshot,
    );
    await insertMany(
        'accounting_calculation_cache',
        prisma.accountingCalculationCache,
    );

    await insertMany('balance_transactions', prisma.balanceTransaction);
    await insertMany('erp_cash_documents', prisma.erpCashDocument);

    await insertMany('salary_accruals', prisma.salaryAccrual);
    await insertMany('salary_accrual_lines', prisma.salaryAccrualLine);
    await insertMany(
        'salary_accrual_line_adjustments',
        prisma.salaryAccrualLineAdjustment,
    );

    await insertMany('motivation_schemas', prisma.motivationSchema);
    await insertMany('salary_rules', prisma.salaryRule);
    await insertMany('work_schedule_entries', prisma.workScheduleEntry);

    await insertMany('sales_plan_templates', prisma.salesPlanTemplate);
    await insertMany('sales_plans', prisma.salesPlan);

    console.log('\nСид-данные загружены.');
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());

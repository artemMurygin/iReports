// Выгружает данные ТЕКУЩЕЙ локальной БД (DATABASE_URL из backend/.env) в
// анонимизированные JSON-фикстуры под prisma/seed-data/ — они и попадают в
// git, чтобы `prisma db seed` (prisma/seed.ts) мог поднять demo-инстанс без
// доступа к боевым ERP и без реальных данных клиентов/сотрудников.
//
// Запускать ТОЛЬКО на своей машине против своей локальной БД:
//   npm run seed:export
//
// bitrix_installations (Bitrix24 OAuth access/refresh token) сознательно не
// выгружается никогда — это не персональные данные, а живые креды с
// доступом к порталу; смысла сидить их для demo-инстанса тоже нет
// (PortalAdminGuard — единственный потребитель — в demo без реального
// Bitrix24-портала всё равно не пройдёт).
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../prisma/generated/prisma/schema/client';
import { moneyFactor, jitterAmount, scaleJsonAmounts } from './lib/money';
import {
    fakePersonName,
    fakeFullName,
    fakePhone,
    fakeEmail,
    fakeSerial,
    fakeMalfunction,
    fakeNote,
    fakeClientName,
} from './lib/fake-data';

// Скрипты сидов всегда запускаются через npm run из backend/ (см. package.json)
// — путь считаем от cwd, а не от __dirname, чтобы не зависеть от вложенности
// dist/ после сборки (nest build компилирует src/scripts/seed в
// dist/src/scripts/seed).
const SEED_DATA_DIR = join(process.cwd(), 'prisma', 'seed-data');

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const manifest: {
    exportedAt: string;
    models: Record<string, { file: string; rows: number }>;
} = { exportedAt: new Date().toISOString(), models: {} };

function writeJsonFile(name: string, rows: unknown[]): void {
    writeFileSync(
        join(SEED_DATA_DIR, `${name}.json`),
        JSON.stringify(rows, null, 2) + '\n',
        'utf-8',
    );
}

async function exportModel<T>(
    name: string,
    fetch: () => Promise<T[]>,
    transform: (row: T) => unknown = (row) => row,
): Promise<void> {
    const rows = await fetch();
    const transformed = rows.map(transform);
    writeJsonFile(name, transformed);
    manifest.models[name] = { file: `${name}.json`, rows: transformed.length };
    console.log(`  ${name}: ${transformed.length}`);
}

async function main() {
    mkdirSync(SEED_DATA_DIR, { recursive: true });

    const installationsCount = await prisma.bitrixInstallation.count();
    if (installationsCount > 0) {
        console.warn(
            `bitrix_installations: пропущено ${installationsCount} строк — ` +
                'таблица с живыми OAuth-токенами Bitrix24 никогда не выгружается.',
        );
    }

    // --- Прогон для карты "кто есть кто" между Bitrix/RoApp/МойСклад и для
    // денежных коэффициентов, чтобы одному и тому же человеку/документу во
    // всех таблицах доставалось одно и то же синтетическое имя/масштаб сумм
    // независимо от порядка последующей выгрузки моделей.
    console.log('Строю карту сотрудников и денежных коэффициентов...');
    const personKeyMap = new Map<string, string>();
    const bitrixEmployeesForMap = await prisma.bitrixEmployee.findMany({
        select: { id: true, roappId: true, moySkladId: true },
    });
    for (const e of bitrixEmployeesForMap) {
        const key = `bx:${e.id}`;
        personKeyMap.set(`bitrixEmployee:${e.id}`, key);
        if (e.roappId != null)
            personKeyMap.set(`roappEmployee:${e.roappId}`, key);
        if (e.moySkladId != null)
            personKeyMap.set(`moySkladEmployee:${e.moySkladId}`, key);
    }
    const identitiesForMap = await prisma.employeeIdentity.findMany({
        where: { identifierType: 'EMPLOYEE_ID' },
        select: { bitrixEmployeeId: true, system: true, externalId: true },
    });
    for (const i of identitiesForMap) {
        const key = `bx:${i.bitrixEmployeeId}`;
        if (i.system === 'ROAPP')
            personKeyMap.set(`roappEmployee:${i.externalId}`, key);
        if (i.system === 'MOY_SKLAD')
            personKeyMap.set(`moySkladEmployee:${i.externalId}`, key);
    }

    const orderFactors = new Map<number, number>();
    for (const o of await prisma.roappOrder.findMany({
        select: { id: true },
    })) {
        orderFactors.set(o.id, moneyFactor(`RoappOrder:${o.id}`));
    }
    const demandFactors = new Map<string, number>();
    for (const d of await prisma.moySkladDemand.findMany({
        select: { id: true },
    })) {
        demandFactors.set(d.id, moneyFactor(`MoySkladDemand:${d.id}`));
    }
    const accrualFactors = new Map<string, number>();
    for (const a of await prisma.salaryAccrual.findMany({
        select: { id: true },
    })) {
        accrualFactors.set(a.id, moneyFactor(`SalaryAccrual:${a.id}`));
    }
    const lineAccrualId = new Map<string, string>();
    for (const l of await prisma.salaryAccrualLine.findMany({
        select: { id: true, accrualId: true },
    })) {
        lineAccrualId.set(l.id, l.accrualId);
    }

    console.log('Выгружаю модели...');

    // Bitrix — справочники
    await exportModel('bitrix_departments', () =>
        prisma.bitrixDepartment.findMany(),
    );
    await exportModel('bitrix_enum_values', () =>
        prisma.bitrixEnumValue.findMany(),
    );
    await exportModel('bitrix_stages', () => prisma.bitrixStage.findMany());
    await exportModel('bitrix_point_of_contacts', () =>
        prisma.bitrixPointOfContact.findMany(),
    );
    await exportModel('bitrix_device_types', () =>
        prisma.bitrixDeviceTypes.findMany(),
    );
    await exportModel('bitrix_lead_sources', () =>
        prisma.bitrixLeadSources.findMany(),
    );

    // RoApp / МойСклад — справочники
    await exportModel('roapp_order_types', () =>
        prisma.roappOrderType.findMany(),
    );
    await exportModel('roapp_marketing_sources', () =>
        prisma.roappMarketingSource.findMany(),
    );
    await exportModel('roapp_order_statuses', () =>
        prisma.roappOrderStatus.findMany(),
    );

    // Сотрудники (сначала RoApp/МойСклад — на них ссылается BitrixEmployee)
    await exportModel(
        'roapp_employees',
        () => prisma.roappEmployee.findMany(),
        (e) => {
            const key =
                personKeyMap.get(`roappEmployee:${e.id}`) ?? `ro:${e.id}`;
            return { ...e, ...fakePersonName(key) };
        },
    );
    await exportModel(
        'moy_sklad_employees',
        () => prisma.moySkladEmployee.findMany(),
        (e) => {
            const key =
                personKeyMap.get(`moySkladEmployee:${e.id}`) ?? `ms:${e.id}`;
            const { firstName, lastName } = fakePersonName(key);
            return {
                ...e,
                name: `${lastName} ${firstName}`,
                firstName,
                lastName,
                middleName: null,
                email: e.email ? fakeEmail(key, firstName) : null,
                phone: e.phone ? fakePhone(key) : null,
            };
        },
    );
    await exportModel(
        'bitrix_employees',
        () => prisma.bitrixEmployee.findMany(),
        (e) => {
            const key = `bx:${e.id}`;
            return { ...e, ...fakePersonName(key) };
        },
    );

    await exportModel(
        'bitrix_deals',
        () => prisma.bitrixDeal.findMany(),
        (d) => {
            const factor = moneyFactor(`BitrixDeal:${d.id}`);
            return {
                ...d,
                title: `Сделка №${d.id}`,
                deviceMalfunction: d.deviceMalfunction
                    ? fakeMalfunction(`BitrixDeal:${d.id}`)
                    : d.deviceMalfunction,
                opportunity: jitterAmount(d.opportunity, factor),
            };
        },
    );

    await exportModel('employee_identities', () =>
        prisma.employeeIdentity.findMany(),
    );

    // RoApp — каталог
    await exportModel('roapp_product_categories', () =>
        prisma.roappProductCategory.findMany(),
    );
    await exportModel(
        'roapp_products',
        () => prisma.roappProduct.findMany(),
        (p) => ({
            ...p,
            price:
                jitterAmount(p.price, moneyFactor(`RoappProduct:${p.id}`)) ??
                p.price,
        }),
    );
    await exportModel('roapp_service_categories', () =>
        prisma.roappServiceCategory.findMany(),
    );
    await exportModel(
        'roapp_service',
        () => prisma.roappService.findMany(),
        (s) => ({
            ...s,
            price:
                jitterAmount(s.price, moneyFactor(`RoappService:${s.id}`)) ??
                s.price,
        }),
    );

    // RoApp — заказы
    await exportModel(
        'roapp_orders',
        () => prisma.roappOrder.findMany(),
        (o) => {
            const factor = orderFactors.get(o.id)!;
            return {
                ...o,
                label: `Заказ №${o.id}`,
                malfunction: o.malfunction
                    ? fakeMalfunction(`RoappOrder:${o.id}:malfunction`)
                    : o.malfunction,
                failReason: o.failReason
                    ? fakeMalfunction(`RoappOrder:${o.id}:failReason`)
                    : o.failReason,
                deviceSerial: o.deviceSerial
                    ? fakeSerial(`RoappOrder:${o.id}`)
                    : o.deviceSerial,
                onlineManager: o.onlineManager
                    ? fakeFullName(`ro-online-manager:${o.onlineManager}`)
                    : o.onlineManager,
                // ИП-поставщики называются собственным ФИО владельца
                // (обычная практика для ИП в России) — это ФИО реального
                // человека, а не название компании.
                serviceSupplierName: o.serviceSupplierName
                    ? `ИП ${fakeFullName(`ro-supplier:${o.serviceSupplierName}`)}`
                    : o.serviceSupplierName,
                discountSum: jitterAmount(o.discountSum, factor),
                payed: jitterAmount(o.payed, factor),
                cost: jitterAmount(o.cost, factor),
                engineerSalary: jitterAmount(o.engineerSalary, factor),
                managerSalary: jitterAmount(o.managerSalary, factor),
            };
        },
    );
    await exportModel(
        'roapp_products_orders',
        () => prisma.roappProductsOrder.findMany(),
        (po) => {
            const factor = orderFactors.get(po.orderId) ?? 1;
            return {
                ...po,
                price: jitterAmount(po.price, factor) ?? po.price,
                cost: jitterAmount(po.cost, factor) ?? po.cost,
            };
        },
    );
    await exportModel(
        'roapp_service_orders',
        () => prisma.roappServiceOrder.findMany(),
        (so) => {
            const factor = orderFactors.get(so.orderId) ?? 1;
            return {
                ...so,
                price: jitterAmount(so.price, factor) ?? so.price,
                cost: jitterAmount(so.cost, factor) ?? so.cost,
                engeneerSalary:
                    jitterAmount(so.engeneerSalary, factor) ??
                    so.engeneerSalary,
            };
        },
    );

    // МойСклад — каталог
    await exportModel('moy_sklad_product_folders', () =>
        prisma.moySkladProductFolder.findMany(),
    );
    await exportModel(
        'moy_sklad_products',
        () => prisma.moySkladProduct.findMany(),
        (p) => {
            const factor = moneyFactor(`MoySkladProduct:${p.id}`);
            return {
                ...p,
                salePrice: jitterAmount(p.salePrice, factor) ?? p.salePrice,
                buyPrice: jitterAmount(p.buyPrice, factor) ?? p.buyPrice,
            };
        },
    );
    await exportModel(
        'moy_sklad_services',
        () => prisma.moySkladService.findMany(),
        (s) => ({
            ...s,
            salePrice:
                jitterAmount(
                    s.salePrice,
                    moneyFactor(`MoySkladService:${s.id}`),
                ) ?? s.salePrice,
        }),
    );

    // МойСклад — отгрузки
    await exportModel(
        'moy_sklad_demands',
        () => prisma.moySkladDemand.findMany(),
        (d) => {
            const factor = demandFactors.get(d.id)!;
            return {
                ...d,
                agentName: d.agentName
                    ? fakeClientName(`MoySkladDemand:${d.id}`)
                    : d.agentName,
                description: d.description
                    ? fakeNote(`MoySkladDemand:${d.id}`)
                    : d.description,
                sum: jitterAmount(d.sum, factor) ?? d.sum,
                payedSum: jitterAmount(d.payedSum, factor) ?? d.payedSum,
            };
        },
    );
    await exportModel(
        'moy_sklad_demand_positions',
        () => prisma.moySkladDemandPosition.findMany(),
        (p) => {
            const factor = demandFactors.get(p.demandId) ?? 1;
            return {
                ...p,
                price: jitterAmount(p.price, factor) ?? p.price,
                sum: jitterAmount(p.sum, factor) ?? p.sum,
                cost: jitterAmount(p.cost, factor) ?? p.cost,
                profit: jitterAmount(p.profit, factor) ?? p.profit,
            };
        },
    );

    // Учётные периоды / кэш расчёта
    await exportModel('domain_sync_status', () =>
        prisma.domainSyncStatus.findMany(),
    );
    await exportModel('accounting_periods', () =>
        prisma.accountingPeriod.findMany(),
    );
    await exportModel(
        'accounting_period_snapshots',
        () => prisma.accountingPeriodSnapshot.findMany(),
        (s) => {
            const factor = moneyFactor(`AccountingPeriodSnapshot:${s.id}`);
            return {
                ...s,
                total: jitterAmount(s.total, factor) ?? s.total,
                lines: scaleJsonAmounts(s.lines, factor),
            };
        },
    );
    await exportModel(
        'accounting_calculation_cache',
        () => prisma.accountingCalculationCache.findMany(),
        (c) => {
            const factor = moneyFactor(`AccountingCalculationCache:${c.id}`);
            return {
                ...c,
                factTotal: jitterAmount(c.factTotal, factor) ?? c.factTotal,
                prognoseTotal:
                    jitterAmount(c.prognoseTotal, factor) ?? c.prognoseTotal,
                factLines: scaleJsonAmounts(c.factLines, factor),
                prognoseLines: scaleJsonAmounts(c.prognoseLines, factor),
            };
        },
    );

    // Баланс / касса / начисления
    await exportModel(
        'balance_transactions',
        () => prisma.balanceTransaction.findMany(),
        (t) => {
            const factor = t.accrualId
                ? (accrualFactors.get(t.accrualId) ??
                  moneyFactor(`BalanceTransaction:${t.id}`))
                : moneyFactor(`BalanceTransaction:${t.id}`);
            return {
                ...t,
                amount: jitterAmount(t.amount, factor) ?? t.amount,
                comment: t.comment
                    ? fakeNote(`BalanceTransaction:${t.id}`)
                    : t.comment,
            };
        },
    );
    await exportModel(
        'erp_cash_documents',
        () => prisma.erpCashDocument.findMany(),
        (d) => ({
            ...d,
            amount:
                jitterAmount(
                    d.amount,
                    moneyFactor(`ErpCashDocument:${d.id}`),
                ) ?? d.amount,
        }),
    );

    await exportModel(
        'salary_accruals',
        () => prisma.salaryAccrual.findMany(),
        (a) => {
            const factor = accrualFactors.get(a.id)!;
            return { ...a, total: jitterAmount(a.total, factor) ?? a.total };
        },
    );
    await exportModel(
        'salary_accrual_lines',
        () => prisma.salaryAccrualLine.findMany(),
        (l) => {
            const factor = accrualFactors.get(l.accrualId)!;
            return {
                ...l,
                originalAmount:
                    jitterAmount(l.originalAmount, factor) ?? l.originalAmount,
                amount: jitterAmount(l.amount, factor) ?? l.amount,
                sources: scaleJsonAmounts(l.sources, factor),
            };
        },
    );
    await exportModel(
        'salary_accrual_line_adjustments',
        () => prisma.salaryAccrualLineAdjustment.findMany(),
        (adj) => {
            const accrualId = lineAccrualId.get(adj.lineId);
            const factor = accrualId
                ? (accrualFactors.get(accrualId) ??
                  moneyFactor(`SalaryAccrualLineAdjustment:${adj.id}`))
                : moneyFactor(`SalaryAccrualLineAdjustment:${adj.id}`);
            return {
                ...adj,
                previousAmount:
                    jitterAmount(adj.previousAmount, factor) ??
                    adj.previousAmount,
                newAmount: jitterAmount(adj.newAmount, factor) ?? adj.newAmount,
                comment: fakeNote(`SalaryAccrualLineAdjustment:${adj.id}`),
            };
        },
    );

    // Мотивация / задачи / график
    await exportModel(
        'motivation_schemas',
        () => prisma.motivationSchema.findMany(),
        (m) => {
            // Персональная схема мотивации сотрудника обычно называется его
            // фамилией (см. каталог схемы) — свободный текст, введённый
            // руководителем, реальное имя человека.
            const label =
                m.targetType === 'Employee'
                    ? `Персональная мотивация №${m.targetId}`
                    : `Мотивация отдела №${m.targetId}`;
            return {
                ...m,
                name: label,
                serviceName: m.serviceName != null ? label : null,
                shopName: m.shopName != null ? label : null,
            };
        },
    );
    await exportModel('salary_rules', () => prisma.salaryRule.findMany());
    await exportModel('work_schedule_entries', () =>
        prisma.workScheduleEntry.findMany(),
    );

    // Планы продаж
    await exportModel('sales_plan_templates', () =>
        prisma.salesPlanTemplate.findMany(),
    );
    await exportModel('sales_plans', () => prisma.salesPlan.findMany());

    writeFileSync(
        join(SEED_DATA_DIR, 'manifest.json'),
        JSON.stringify(manifest, null, 2) + '\n',
        'utf-8',
    );

    console.log(`\nГотово. Фикстуры записаны в ${SEED_DATA_DIR}`);
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());

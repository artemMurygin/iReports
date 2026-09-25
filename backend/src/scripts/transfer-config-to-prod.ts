// Разовый перенос бизнес-данных, настроенных вручную в dev (график работы,
// мотивационные схемы/зарплатные правила, роли и доступы), в prod при
// выкатке релиза. НЕ путать с seed:export/db:seed (prisma/seed-data/) —
// та пара анонимизирует данные для demo-инстанса и накатывает их через
// TRUNCATE, здесь наоборот: копируются реальные данные компании идемпотентным
// upsert'ом, ничего в целевой БД не удаляется.
//
// Предпосылки:
//   - dev и prod синхронизированы с ОДНИМ И ТЕМ ЖЕ Bitrix24-порталом, поэтому
//     bitrixEmployeeId (натуральный ключ WorkScheduleEntry/EmployeeRole)
//     совпадает в обеих БД — сотрудников переотображать не нужно.
//   - на prod уже прогнан `npm run seed:permissions` (каталог Permission и
//     системная роль Administrator существуют) — иначе RolePermission
//     переносить не из чего.
//   - Role/Permission.id — независимо сгенерированные UUID в каждой БД,
//     поэтому Role сопоставляется по name, Permission — по code, а не по id.
//   - Системная роль Administrator (isSystem) и её назначения сотрудникам
//     НЕ переносятся — кто в prod админ, решается вручную через UI, а не
//     копированием из dev.
//
// Запуск (по умолчанию dry-run, ничего не пишет):
//   SOURCE_DATABASE_URL=postgres://...dev  \
//   TARGET_DATABASE_URL=postgres://...prod \
//   npm run transfer:config-to-prod
//
// Запись в целевую БД — только с явным флагом:
//   npm run transfer:config-to-prod -- --commit
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
    workScheduleEntries: { created: 0, updated: 0 },
    motivationSchemas: { created: 0, updated: 0 },
    salaryRules: { created: 0, updated: 0 },
    roles: { created: 0, updated: 0, skippedSystem: 0 },
    rolePermissions: { created: 0, skippedMissingPermission: [] as string[] },
    employeeRoles: {
        created: 0,
        skippedSystem: 0,
        skippedMissingEmployee: [] as number[],
    },
};

async function transferWorkSchedule() {
    const rows = await source.workScheduleEntry.findMany();
    for (const row of rows) {
        const existing = await target.workScheduleEntry.findUnique({
            where: {
                employeeId_date: { employeeId: row.employeeId, date: row.date },
            },
        });
        if (existing) {
            summary.workScheduleEntries.updated++;
        } else {
            summary.workScheduleEntries.created++;
        }
        if (!COMMIT) continue;
        await target.workScheduleEntry.upsert({
            where: {
                employeeId_date: { employeeId: row.employeeId, date: row.date },
            },
            update: {
                status: row.status,
                hours: row.hours,
                role: row.role,
                isOnDuty: row.isOnDuty,
            },
            create: {
                id: randomUUID(),
                employeeId: row.employeeId,
                date: row.date,
                status: row.status,
                hours: row.hours,
                role: row.role,
                isOnDuty: row.isOnDuty,
            },
        });
    }
    console.log(`work_schedule_entries: ${rows.length} строк в источнике`);
}

async function transferMotivationSchemasAndRules() {
    const schemas = await source.motivationSchema.findMany();
    const rules = await source.salaryRule.findMany();

    for (const schema of schemas) {
        const existing = await target.motivationSchema.findUnique({
            where: { id: schema.id },
        });
        if (existing) {
            summary.motivationSchemas.updated++;
        } else {
            summary.motivationSchemas.created++;
        }
        if (!COMMIT) continue;
        await target.motivationSchema.upsert({
            where: { id: schema.id },
            update: {
                targetType: schema.targetType,
                targetId: schema.targetId,
                name: schema.name,
                serviceName: schema.serviceName,
                shopName: schema.shopName,
            },
            create: schema,
        });
    }
    console.log(`motivation_schemas: ${schemas.length} строк в источнике`);

    for (const rule of rules) {
        const existing = await target.salaryRule.findUnique({
            where: { id: rule.id },
        });
        if (existing) {
            summary.salaryRules.updated++;
        } else {
            summary.salaryRules.created++;
        }
        if (!COMMIT) continue;
        await target.salaryRule.upsert({
            where: { id: rule.id },
            update: {
                type: rule.type,
                name: rule.name,
                targetRole: rule.targetRole,
                direction: rule.direction,
                isActive: rule.isActive,
                props: rule.props as object,
            },
            create: {
                id: rule.id,
                motivationSchemaId: rule.motivationSchemaId,
                type: rule.type,
                name: rule.name,
                targetRole: rule.targetRole,
                direction: rule.direction,
                isActive: rule.isActive,
                props: rule.props as object,
            },
        });
    }
    console.log(`salary_rules: ${rules.length} строк в источнике`);
}

async function transferRolesAndAccess() {
    const roles = await source.role.findMany();
    const rolePermissions = await source.rolePermission.findMany({
        include: { permission: true },
    });
    const employeeRoles = await source.employeeRole.findMany();

    // roleId (dev) -> roleId (prod)
    const roleIdMap = new Map<string, string>();

    for (const role of roles) {
        if (role.isSystem) {
            summary.roles.skippedSystem++;
            continue;
        }
        const existing = await target.role.findUnique({
            where: { name: role.name },
        });
        if (existing) {
            roleIdMap.set(role.id, existing.id);
            summary.roles.updated++;
        } else {
            summary.roles.created++;
        }
        if (!COMMIT) continue;
        const prodRole =
            existing ??
            (await target.role.create({
                data: { id: randomUUID(), name: role.name, isSystem: false },
            }));
        roleIdMap.set(role.id, prodRole.id);
    }
    console.log(
        `roles: ${roles.length} строк в источнике (${summary.roles.skippedSystem} системных пропущено)`,
    );

    for (const rp of rolePermissions) {
        const sourceRole = roles.find((r) => r.id === rp.roleId);
        if (!sourceRole || sourceRole.isSystem) continue;
        const prodPermission = await target.permission.findUnique({
            where: { code: rp.permission.code },
        });
        if (!prodPermission) {
            summary.rolePermissions.skippedMissingPermission.push(
                rp.permission.code,
            );
            continue;
        }
        const prodRoleId = roleIdMap.get(rp.roleId);
        if (!prodRoleId) continue;
        if (!COMMIT) {
            summary.rolePermissions.created++;
            continue;
        }

        await target.rolePermission.upsert({
            where: {
                roleId_permissionId: {
                    roleId: prodRoleId,
                    permissionId: prodPermission.id,
                },
            },
            update: {},
            create: { roleId: prodRoleId, permissionId: prodPermission.id },
        });
        summary.rolePermissions.created++;
    }
    console.log(
        `role_permissions: ${rolePermissions.length} строк в источнике`,
    );

    for (const er of employeeRoles) {
        const sourceRole = roles.find((r) => r.id === er.roleId);
        if (!sourceRole) continue;
        if (sourceRole.isSystem) {
            summary.employeeRoles.skippedSystem++;
            continue;
        }
        const prodEmployee = await target.bitrixEmployee.findUnique({
            where: { id: er.bitrixEmployeeId },
        });
        if (!prodEmployee) {
            summary.employeeRoles.skippedMissingEmployee.push(
                er.bitrixEmployeeId,
            );
            continue;
        }
        const prodRoleId = roleIdMap.get(er.roleId);
        if (!prodRoleId) continue;
        if (!COMMIT) {
            summary.employeeRoles.created++;
            continue;
        }

        await target.employeeRole.upsert({
            where: {
                bitrixEmployeeId_roleId: {
                    bitrixEmployeeId: er.bitrixEmployeeId,
                    roleId: prodRoleId,
                },
            },
            update: {},
            create: {
                bitrixEmployeeId: er.bitrixEmployeeId,
                roleId: prodRoleId,
            },
        });
        summary.employeeRoles.created++;
    }
    console.log(`employee_roles: ${employeeRoles.length} строк в источнике`);
}

async function main() {
    console.log(
        COMMIT
            ? 'Режим записи (--commit): изменения будут применены к TARGET_DATABASE_URL.'
            : 'Dry-run (флаг --commit не передан): только подсчёт, ничего не пишу.',
    );

    await transferWorkSchedule();
    await transferMotivationSchemasAndRules();
    await transferRolesAndAccess();

    console.log('\nИтог:', JSON.stringify(summary, null, 2));

    if (summary.rolePermissions.skippedMissingPermission.length > 0) {
        console.warn(
            '\nВНИМАНИЕ: часть permission-кодов не найдена в целевом каталоге ' +
                '(похоже, на prod не запускали npm run seed:permissions с актуальным ' +
                'кодом, либо код ещё не задеплоен):',
            [...new Set(summary.rolePermissions.skippedMissingPermission)],
        );
    }
    if (summary.employeeRoles.skippedMissingEmployee.length > 0) {
        console.warn(
            '\nВНИМАНИЕ: часть сотрудников не найдена в prod (ещё не синхронизированы из Bitrix24), роль не назначена:',
            [...new Set(summary.employeeRoles.skippedMissingEmployee)],
        );
    }
    if (
        summary.roles.skippedSystem > 0 ||
        summary.employeeRoles.skippedSystem > 0
    ) {
        console.warn(
            '\nСистемная роль Administrator и её назначения сознательно не переносились — ' +
                'кто админ на prod, назначьте вручную через UI.',
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

import { Inject, Injectable } from '@nestjs/common';
import { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/shop-salary-rule.types';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/shop-motivation-schema.entity';
import { mergeEmployeeSalaryRules } from '@/shared/domain/employee-salary-rules';
import { motivationSchemasVersion } from '@/domains/shop/modules/accounting/domain/services/shop-accounting-cache-freshness';
import { SHOP_MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import { SHOP_CALCULATION_DATA } from '@/domains/shop/modules/accounting/application/ports/shop-calculation-data.port';
import type { ShopCalculationDataPort } from '@/domains/shop/modules/accounting/application/ports/shop-calculation-data.port';

// Набор правил сотрудника вместе с версией схем, из которых он собран, —
// версия нужна вызывающему для freshnessStamp ленивого кэша и обязана
// учитывать ОБЕ схемы (см. motivationSchemasVersion).
export interface ResolvedShopEmployeeSalaryRules {
    rules: ShopSalaryRule[];
    schemasVersion: string;
}

const EMPTY: ResolvedShopEmployeeSalaryRules = {
    rules: [],
    schemasVersion: 'none',
};

// Зеркало ResolveEmployeeSalaryRulesService (domains/service) — единственный
// легальный вход к зарплатным правилам сотрудника направления shop (отчёт
// сотрудника, отчёт отдела, закрытие периода).
//
// Правила сотрудника живут в ДВУХ схемах: личной (targetType = 'Employee')
// и схеме его отдела (targetType = 'Department') — обе применяются и
// суммируются. Раньше расчёт звал ShopMotivationSchemaRepositoryPort.
// findByEmployee напрямую и видел только личную половину, поэтому
// сотрудник, мотивация которого заведена на отдел (обычный случай — схема
// заводится на отдел один раз, а не на каждого), получал пустой набор
// правил и нули во всём отчёте.
//
// mergeEmployeeSalaryRules переиспользуется из domains/service: функция
// структурно типизирована (RulesHolder) именно ради переиспользования обоими
// доменами — склейка двух списков правил не бизнес-правило направления, а
// общий механизм расчётного модуля. motivationSchemasVersion — с Фазы 5
// docs/service-shop-boundary-violations-fix собственная независимая копия
// shop (см. domain/services/shop-accounting-cache-freshness.ts), а не
// импорт из domains/service.
@Injectable()
export class ResolveShopEmployeeSalaryRulesService {
    constructor(
        @Inject(SHOP_MOTIVATION_SCHEMA_REPOSITORY)
        private readonly motivationSchemaRepo: ShopMotivationSchemaRepositoryPort,
        @Inject(SHOP_CALCULATION_DATA)
        private readonly dataSource: ShopCalculationDataPort,
    ) {}

    // Один сотрудник (GET /v1/shop/accounting/salary_report/employee/:id/
    // :period). Отдел читается здесь же — вызывающий его не знает.
    async forEmployee(
        employeeId: number,
    ): Promise<ResolvedShopEmployeeSalaryRules> {
        const [personalSchema, departmentId] = await Promise.all([
            this.motivationSchemaRepo.findByEmployee(employeeId),
            this.dataSource.findEmployeeDepartmentId(employeeId),
        ]);

        const departmentSchema =
            departmentId == null
                ? null
                : await this.motivationSchemaRepo.findByDepartment(
                      departmentId,
                  );

        return combine(departmentSchema, personalSchema);
    }

    // Весь отдел сразу (GET .../salary_report/department/:id/:period) — два
    // запроса на отдел вместо двух на сотрудника ("не должно быть N+1
    // запросов при расчёте отдела"). Схема отдела у всех сотрудников одна и
    // та же — отдел здесь уже параметр запроса.
    async forDepartment(
        departmentId: number,
        employeeIds: number[],
    ): Promise<Map<number, ResolvedShopEmployeeSalaryRules>> {
        const [personalSchemas, departmentSchema] = await Promise.all([
            this.motivationSchemaRepo.findByEmployees(employeeIds),
            this.motivationSchemaRepo.findByDepartment(departmentId),
        ]);

        const personalByEmployee = indexByTarget(personalSchemas);

        return new Map(
            employeeIds.map((employeeId) => [
                employeeId,
                combine(
                    departmentSchema,
                    personalByEmployee.get(employeeId) ?? null,
                ),
            ]),
        );
    }

    // Все сотрудники, у которых вообще есть зарплатные правила (закрытие
    // периода): сотрудники с личной схемой ПЛЮС все сотрудники отделов, на
    // которые заведена схема. Без второй половины закрытие месяца
    // зафиксировало бы таким сотрудникам ноль неизменяемым снапшотом.
    async forAllTargets(): Promise<
        Map<number, ResolvedShopEmployeeSalaryRules>
    > {
        const [personalSchemas, departmentSchemas] = await Promise.all([
            this.motivationSchemaRepo.findAllEmployeeTargets(),
            this.motivationSchemaRepo.findAllDepartmentTargets(),
        ]);

        const personalByEmployee = indexByTarget(personalSchemas);
        const departmentByEmployee = new Map<number, ShopMotivationSchema>();

        for (const departmentSchema of departmentSchemas) {
            const departmentId = departmentSchema.getProps().target.getId();
            const employees =
                await this.dataSource.findEmployeesInDepartment(departmentId);
            for (const employee of employees) {
                departmentByEmployee.set(employee.id, departmentSchema);
            }
        }

        const employeeIds = new Set([
            ...personalByEmployee.keys(),
            ...departmentByEmployee.keys(),
        ]);

        return new Map(
            [...employeeIds].map((employeeId) => [
                employeeId,
                combine(
                    departmentByEmployee.get(employeeId) ?? null,
                    personalByEmployee.get(employeeId) ?? null,
                ),
            ]),
        );
    }
}

function combine(
    departmentSchema: ShopMotivationSchema | null,
    personalSchema: ShopMotivationSchema | null,
): ResolvedShopEmployeeSalaryRules {
    if (!departmentSchema && !personalSchema) {
        return EMPTY;
    }
    return {
        rules: mergeEmployeeSalaryRules(departmentSchema, personalSchema),
        // Порядок [личная, отдел] фиксирован и должен совпадать у всех
        // вызывающих — иначе один и тот же сотрудник получил бы разные
        // freshnessStamp из отчёта сотрудника и из отчёта отдела и
        // пересчитывался бы на каждом чтении, попеременно затирая кэш.
        schemasVersion: motivationSchemasVersion([
            personalSchema,
            departmentSchema,
        ]),
    };
}

function indexByTarget(
    schemas: ShopMotivationSchema[],
): Map<number, ShopMotivationSchema> {
    return new Map(
        schemas.map((schema) => [schema.getProps().target.getId(), schema]),
    );
}

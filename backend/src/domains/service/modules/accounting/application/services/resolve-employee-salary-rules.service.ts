import { Inject, Injectable } from '@nestjs/common';
import { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { mergeEmployeeSalaryRules } from '@/shared/domain/employee-salary-rules';
import { AccountingCacheFreshness } from '@/domains/service/modules/accounting/domain/services/accounting-cache-freshness';
import { MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import { SERVICE_CALCULATION_DATA } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';

// Набор правил сотрудника вместе с версией схем, из которых он собран, —
// версия нужна вызывающему для freshnessStamp ленивого кэша и обязана
// учитывать ОБЕ схемы (см. AccountingCacheFreshness.schemaPairVersion).
export interface ResolvedEmployeeSalaryRules {
    rules: SalaryRule[];
    schemasVersion: string;
}

const EMPTY: ResolvedEmployeeSalaryRules = {
    rules: [],
    schemasVersion: 'none',
};

// Единственный легальный вход к зарплатным правилам сотрудника для расчёта
// (отчёт сотрудника, отчёт отдела, закрытие периода).
//
// Правила сотрудника живут в ДВУХ схемах: личной (targetType = 'Employee')
// и схеме его отдела (targetType = 'Department') — обе применяются и
// суммируются (см. mergeEmployeeSalaryRules). Раньше расчёт звал
// MotivationSchemaRepositoryPort.findByEmployee напрямую и видел только
// личную половину, поэтому сотрудник, мотивация которого заведена на отдел
// (обычный случай — схема заводится на отдел один раз, а не на каждого),
// получал пустой набор правил и нули во всём отчёте.
//
// Сервис заводится ради трёх вызывающих: у каждого свой способ узнать
// отдел (отчёт сотрудника — запросом по сотруднику, отчёт отдела — отдел
// уже параметр запроса, закрытие периода — обходом всех схем), но
// склеивание половин и версия схем у всех трёх обязаны быть одни и те же,
// иначе они разойдутся в суммах и в инвалидации кэша.
@Injectable()
export class ResolveEmployeeSalaryRulesService {
    constructor(
        @Inject(MOTIVATION_SCHEMA_REPOSITORY)
        private readonly motivationSchemaRepo: MotivationSchemaRepositoryPort,
        @Inject(SERVICE_CALCULATION_DATA)
        private readonly dataSource: ServiceCalculationDataPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
    ) {}

    // Один сотрудник (GET .../salary_report/employee/:id/:period). Отдел
    // читается здесь же — вызывающий его не знает.
    async forEmployee(
        employeeId: number,
    ): Promise<ResolvedEmployeeSalaryRules> {
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
    // запроса на отдел вместо двух на сотрудника (см. PRD: "не должно быть
    // N+1 запросов при расчёте отдела"). Схема отдела у всех сотрудников
    // одна и та же — отдел здесь уже параметр запроса.
    async forDepartment(
        departmentId: number,
        employeeIds: number[],
    ): Promise<Map<number, ResolvedEmployeeSalaryRules>> {
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
    async forAllTargets(): Promise<Map<number, ResolvedEmployeeSalaryRules>> {
        const [personalSchemas, departmentSchemas, serviceAccountIds] =
            await Promise.all([
                this.motivationSchemaRepo.findAllEmployeeTargets(),
                this.motivationSchemaRepo.findAllDepartmentTargets(),
                this.directoryRepo.findServiceAccountEmployeeIds(),
            ]);

        // Личная схема служебного аккаунта не должна фиксировать снапшот/
        // начисление при закрытии периода (docs/employee-ordering-and-salary-filter,
        // Фаза 3, "не попадают ... в расчёты") — в отличие от схемы отдела,
        // MotivationSchemaRepository.findAllEmployeeTargets не проходит
        // через DirectoryRepository.findEmployeesInDepartment (уже
        // отфильтрован там), поэтому отсев нужен здесь отдельно.
        const personalByEmployee = indexByTarget(
            personalSchemas.filter(
                (schema) =>
                    !serviceAccountIds.has(schema.getProps().target.getId()),
            ),
        );
        const departmentByEmployee = new Map<number, MotivationSchema>();

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
    departmentSchema: MotivationSchema | null,
    personalSchema: MotivationSchema | null,
): ResolvedEmployeeSalaryRules {
    if (!departmentSchema && !personalSchema) {
        return EMPTY;
    }
    return {
        rules: mergeEmployeeSalaryRules(departmentSchema, personalSchema),
        // Порядок [личная, отдел] фиксирован и должен совпадать у всех
        // вызывающих — иначе один и тот же сотрудник получил бы разные
        // freshnessStamp из отчёта сотрудника и из отчёта отдела и
        // пересчитывался бы на каждом чтении, попеременно затирая кэш.
        schemasVersion: AccountingCacheFreshness.schemaPairVersion([
            personalSchema,
            departmentSchema,
        ]),
    };
}

function indexByTarget(
    schemas: MotivationSchema[],
): Map<number, MotivationSchema> {
    return new Map(
        schemas.map((schema) => [schema.getProps().target.getId(), schema]),
    );
}

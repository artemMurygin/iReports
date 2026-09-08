import { Inject, Injectable } from '@nestjs/common';
import type {
    ListMotivationSchemasQuery,
    ListMotivationSchemasResponse,
} from 'ireports-contracts';
import { MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import type { MotivationTargetType } from '@/domains/service/modules/accounting/domain/value-objects/motivation-target.value-object';
import { MotivationSchemaMapper } from '@/domains/service/modules/accounting/infrastructure/mappers/motivation-schema/motivation-schema.mapper';

// Список мотивационных схем направления service (GET
// /v1/service/motivation-schema, Фаза "Редактирование зарплатных схем").
// DI-провайдер, а не CQRS-запрос — тот же приём, что и
// ListSalaryRuleTypesService у остальных read-эндпоинтов модуля.
@Injectable()
export class ListMotivationSchemasService {
    private readonly mapper = new MotivationSchemaMapper();

    constructor(
        @Inject(MOTIVATION_SCHEMA_REPOSITORY)
        private readonly motivationSchemaRepo: MotivationSchemaRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
    ) {}

    async execute(
        query: ListMotivationSchemasQuery,
    ): Promise<ListMotivationSchemasResponse> {
        const schemas = await this.motivationSchemaRepo.findAll({
            targetType: query.targetType,
            targetId: query.targetId,
            search: query.search,
        });

        // Схема с 0 правилами направления service (rules уже отфильтрованы
        // репозиторием по direction='service') — для этого домена она как
        // будто не существует, даже если строка motivation_schemas физически
        // есть (правила принадлежат shop-стороне той же схемы, см. apiDesign
        // плана и открытый вопрос про смешанные схемы).
        let ownSchemas = schemas.filter(
            (schema) => schema.getProps().rules.length > 0,
        );
        if (ownSchemas.length === 0) {
            return [];
        }

        // Схема, заведённая на служебный аккаунт (docs/employee-ordering-and-salary-filter,
        // Фаза 3, "не попадают ... в списки"), исключается явно, ДО
        // резолвинга имени — иначе она попала бы в ответ с реальным именем
        // сотрудника вместо того, чтобы отсутствовать вовсе (в отличие от
        // resolveTargetName ниже — та заглушка только для сотрудника,
        // действительно отсутствующего в Bitrix24).
        const serviceAccountIds =
            await this.directoryRepo.findServiceAccountEmployeeIds();
        ownSchemas = ownSchemas.filter((schema) => {
            const target = schema.getProps().target;
            return (
                target.getType() !== 'Employee' ||
                !serviceAccountIds.has(target.getId())
            );
        });
        if (ownSchemas.length === 0) {
            return [];
        }

        // Один батч-запрос на весь список (не N+1) — тот же принцип, что и
        // у GetDepartmentSalaryReportService. findEmployees() по умолчанию
        // уже исключает служебные аккаунты (см. WHY на FindEmployeesOptions
        // в directory.port.ts) — здесь это не задействовано (схемы на них
        // уже отсеяны выше), но и не мешает: employeeNames/employeeOrder
        // просто не содержат их ключей.
        const [departments, employees] = await Promise.all([
            this.directoryRepo.findDepartments(),
            this.directoryRepo.findEmployees(),
        ]);
        const departmentNames = new Map(
            departments.map((department) => [department.id, department.name]),
        );
        const employeeNames = new Map(
            employees.map((employee) => [
                employee.id,
                `${employee.firstName} ${employee.lastName}`,
            ]),
        );
        // Единый порядок сотрудников (docs/employee-ordering-and-salary-filter,
        // Фаза 1) — employees уже отсортирован по order
        // (DirectoryRepository.findEmployees), здесь берём позицию
        // сотрудника в этом списке как ключ сортировки схем с targetType
        // Employee. Схемы с targetType Department сортировкой не
        // затрагиваются (order определён только для сотрудников, PRD не
        // требует единого порядка отделов) — сравнение между схемами
        // разных targetType не меняет их взаимный порядок (см. compare ниже).
        const employeeOrder = new Map(
            employees.map((employee, index) => [employee.id, index]),
        );

        ownSchemas.sort((a, b) => {
            const targetA = a.getProps().target;
            const targetB = b.getProps().target;
            if (
                targetA.getType() !== 'Employee' ||
                targetB.getType() !== 'Employee'
            ) {
                return 0;
            }
            return (
                (employeeOrder.get(targetA.getId()) ?? Infinity) -
                (employeeOrder.get(targetB.getId()) ?? Infinity)
            );
        });

        return ownSchemas.map((schema) => {
            const target = schema.getProps().target;
            const targetName = resolveTargetName(
                target.getType(),
                target.getId(),
                departmentNames,
                employeeNames,
            );
            return this.mapper.toListItemResponse(schema, targetName);
        });
    }
}

// Фоллбек для targetId, не найденного в справочнике Bitrix (отдел/сотрудник
// удалён/переименован после создания схемы) — решение по открытому вопросу
// плана: не скрывать схему, а показать её с заглушкой имени.
function resolveTargetName(
    type: MotivationTargetType,
    id: number,
    departmentNames: Map<number, string>,
    employeeNames: Map<number, string>,
): string {
    const name =
        type === 'Department' ? departmentNames.get(id) : employeeNames.get(id);
    return name ?? `Неизвестно (id: ${id})`;
}

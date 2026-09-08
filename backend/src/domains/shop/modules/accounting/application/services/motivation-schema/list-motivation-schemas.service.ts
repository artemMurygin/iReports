import { Inject, Injectable } from '@nestjs/common';
import type {
    ListShopMotivationSchemasQuery,
    ListShopMotivationSchemasResponse,
} from 'ireports-contracts';
import { SHOP_MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import type { ShopMotivationTargetType } from '@/domains/shop/modules/accounting/domain/value-objects/motivation-target.value-object';
import { ShopMotivationSchemaMapper } from '@/domains/shop/modules/accounting/infrastructure/mappers/motivation-schema/motivation-schema.mapper';

// Зеркало domains/service/modules/accounting/application/services/
// list-motivation-schemas.service.ts (Фаза "Редактирование зарплатных
// схем", issue #57) — независимая копия для направления shop. Список
// мотивационных схем направления shop (GET
// /v1/shop/accounting/motivation-schema). DI-провайдер, а не CQRS-запрос —
// тот же приём, что и ListShopSalaryRuleTypesService у остальных
// read-эндпоинтов модуля.
@Injectable()
export class ListShopMotivationSchemasService {
    private readonly mapper = new ShopMotivationSchemaMapper();

    constructor(
        @Inject(SHOP_MOTIVATION_SCHEMA_REPOSITORY)
        private readonly shopMotivationSchemaRepo: ShopMotivationSchemaRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
    ) {}

    async execute(
        query: ListShopMotivationSchemasQuery,
    ): Promise<ListShopMotivationSchemasResponse> {
        const schemas = await this.shopMotivationSchemaRepo.findAll({
            targetType: query.targetType,
            targetId: query.targetId,
            search: query.search,
        });

        // Схема с 0 правилами направления shop (rules уже отфильтрованы
        // репозиторием по direction='shop') — для этого домена она как
        // будто не существует, даже если строка motivation_schemas физически
        // есть (правила принадлежат service-стороне той же схемы, см.
        // apiDesign плана и открытый вопрос про смешанные схемы).
        let ownSchemas = schemas.filter(
            (schema) => schema.getProps().rules.length > 0,
        );
        if (ownSchemas.length === 0) {
            return [];
        }

        // Схема, заведённая на служебный аккаунт (docs/employee-ordering-and-salary-filter,
        // Фаза 3) — зеркало ListMotivationSchemasService (domains/service),
        // см. WHY там.
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
        // у GetShopDepartmentSalaryReportService.
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
    type: ShopMotivationTargetType,
    id: number,
    departmentNames: Map<number, string>,
    employeeNames: Map<number, string>,
): string {
    const name =
        type === 'Department' ? departmentNames.get(id) : employeeNames.get(id);
    return name ?? `Неизвестно (id: ${id})`;
}

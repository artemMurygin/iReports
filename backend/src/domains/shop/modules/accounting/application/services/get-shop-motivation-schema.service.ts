import { Inject, Injectable } from '@nestjs/common';
import type { ShopMotivationSchemaDetailResponse } from 'ireports-contracts';
import { NotFoundException } from '@/shared/exceptions';
import { SHOP_MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import type { ShopMotivationTargetType } from '@/domains/shop/modules/accounting/domain/value-objects/shop-motivation-target.value-object';
import { toShopMotivationSchemaResponse } from '@/domains/shop/modules/accounting/application/mappers/to-shop-motivation-schema-response';

// Зеркало domains/service/modules/accounting/application/services/
// get-motivation-schema.service.ts (Фаза "Редактирование зарплатных схем",
// issue #57) — независимая копия для направления shop. Деталь
// мотивационной схемы направления shop (GET
// /v1/shop/accounting/motivation-schema/:id) — предзаполнение формы
// редактирования.
@Injectable()
export class GetShopMotivationSchemaService {
    constructor(
        @Inject(SHOP_MOTIVATION_SCHEMA_REPOSITORY)
        private readonly shopMotivationSchemaRepo: ShopMotivationSchemaRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
    ) {}

    async execute(id: string): Promise<ShopMotivationSchemaDetailResponse> {
        const schema = await this.shopMotivationSchemaRepo.findById(id);

        // Строки нет ИЛИ у неё 0 правил direction='shop' — для этого домена
        // схема трактуется как не найденная (см. apiDesign плана
        // "Редактирование зарплатных схем").
        if (!schema || schema.getProps().rules.length === 0) {
            throw new NotFoundException('Мотивационная схема не найдена');
        }

        const target = schema.getProps().target;
        const targetName = await this.resolveTargetName(
            target.getType(),
            target.getId(),
        );

        return toShopMotivationSchemaResponse(schema, targetName);
    }

    private async resolveTargetName(
        type: ShopMotivationTargetType,
        id: number,
    ): Promise<string> {
        if (type === 'Department') {
            const departments = await this.directoryRepo.findDepartments();
            const department = departments.find(
                (candidate) => candidate.id === id,
            );
            return department?.name ?? `Неизвестно (id: ${id})`;
        }

        const employees = await this.directoryRepo.findEmployees();
        const employee = employees.find((candidate) => candidate.id === id);
        return employee
            ? `${employee.firstName} ${employee.lastName}`
            : `Неизвестно (id: ${id})`;
    }
}

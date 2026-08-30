import { Inject, Injectable } from '@nestjs/common';
import type { MotivationSchemaDetailResponse } from 'ireports-contracts';
import { NotFoundException } from '@/shared/exceptions';
import { MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import type { MotivationTargetType } from '@/domains/service/modules/accounting/domain/value-objects/motivation-target.value-object';
import { MotivationSchemaMapper } from '@/domains/service/modules/accounting/infrastructure/mappers/motivation-schema/motivation-schema.mapper';

// Деталь мотивационной схемы направления service (GET
// /v1/service/motivation-schema/:id) — предзаполнение формы редактирования.
@Injectable()
export class GetMotivationSchemaService {
    private readonly mapper = new MotivationSchemaMapper();

    constructor(
        @Inject(MOTIVATION_SCHEMA_REPOSITORY)
        private readonly motivationSchemaRepo: MotivationSchemaRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
    ) {}

    async execute(id: string): Promise<MotivationSchemaDetailResponse> {
        const schema = await this.motivationSchemaRepo.findById(id);

        // Строки нет ИЛИ у неё 0 правил direction='service' — для этого
        // домена схема трактуется как не найденная (см. apiDesign плана
        // "Редактирование зарплатных схем").
        if (!schema || schema.getProps().rules.length === 0) {
            throw new NotFoundException('Мотивационная схема не найдена');
        }

        const target = schema.getProps().target;
        const targetName = await this.resolveTargetName(
            target.getType(),
            target.getId(),
        );

        return this.mapper.toDetailResponse(schema, targetName);
    }

    private async resolveTargetName(
        type: MotivationTargetType,
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

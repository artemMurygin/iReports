import { Inject, Injectable } from '@nestjs/common';
import type { MotivationSchemaDetailResponse } from 'ireports-contracts';
import { NotFoundException } from '@/shared/exceptions';
import { MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import type { MotivationTargetType } from '@/domains/service/modules/accounting/domain/value-objects/motivation-target.value-object';
import { toMotivationSchemaResponse } from '@/domains/service/modules/accounting/application/mappers/to-motivation-schema-response';
import { EnsureTaskRulesOnReadService } from '@/domains/service/modules/accounting/application/services/ensure-task-rules-on-read.service';
import { Period } from '@/shared/domain/period.value-object';

// Деталь мотивационной схемы направления service (GET
// /v1/service/motivation-schema/:id) — предзаполнение формы редактирования.
@Injectable()
export class GetMotivationSchemaService {
    constructor(
        @Inject(MOTIVATION_SCHEMA_REPOSITORY)
        private readonly motivationSchemaRepo: MotivationSchemaRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
        private readonly ensureTaskRules: EnsureTaskRulesOnReadService,
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

        // Ленивое достраивание задачи регулярного правила-задачи на текущий
        // расчётный месяц (задача 7.2 change salary-rule-bitrix-task) —
        // только для схемы на сотрудника: правило TaskCompleted недоступно
        // на схеме отдела (spec.md, "Создание правила-задачи только в схеме
        // на сотрудника"), поэтому у схемы отдела ensureAll() всё равно не
        // нашёл бы ни одного правила TaskCompleted, но проверка
        // target.isEmployee() дешевле, чем резолвить employeeId для отдела.
        if (target.isEmployee()) {
            await this.ensureTaskRules.ensureAll(
                schema.getProps().rules,
                target.getId(),
                Period.current().getValue(),
            );
        }

        const targetName = await this.resolveTargetName(
            target.getType(),
            target.getId(),
        );

        return toMotivationSchemaResponse(schema, targetName);
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

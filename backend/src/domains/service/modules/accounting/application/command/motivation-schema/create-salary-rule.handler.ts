import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateSalaryRuleCommand } from '@/domains/service/modules/accounting/application/command/motivation-schema/create-salary-rule.command';
import type { SalaryRuleRepositoryPort } from '../../ports/motivation-schema/salary-rule.port';
import { SALARY_RULE_REPOSITORY } from '../../ports/motivation-schema/salary-rule.port';
import type { MotivationSchemaRepositoryPort } from '../../ports/motivation-schema/motivation-schema.port';
import { MOTIVATION_SCHEMA_REPOSITORY } from '../../ports/motivation-schema/motivation-schema.port';
import { SalaryRuleFactory } from '@/domains/service/modules/accounting/domain/factories/salary-rule.factory';
import { NotFoundException } from '@/shared/exceptions';
import { TaskCompletionRequiresPersonalSchemaException } from '@/domains/service/modules/accounting/domain/exceptions/motivation-schema.exception';
import type { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';

// Создание одного зарплатного правила — общая точка и для
// CreateMotivationSchemaHandler (новая схема), и для
// UpdateMotivationSchemaHandler (полная замена набора правил при PATCH, см.
// WHY там).
//
// replace-bitrix-task-integration, design.md решение 4 — правило
// TaskCompletion БОЛЬШЕ НЕ идёт отдельной веткой с обращением во внешний
// модуль: задача уже создана ОТДЕЛЬНЫМ, предшествующим запросом с фронта
// (`POST /v1/tasks`), её id приходит в теле этого запроса как часть
// `config.taskId` и просто сохраняется в `config.taskIdByPeriod[текущийПериод]`
// (см. TaskCompletion.create()/buildTaskCompletionConfig()) как часть ОДНОГО,
// уже существующего локального `insert(rule)` — без UNIT_OF_WORK, без
// компенсации (прежняя атомарность и Bitrix-компенсация были нужны именно
// из-за совместного создания задачи и правила в одном запросе, которого
// больше нет). Единственная сохранившаяся проверка — правило TaskCompletion
// по-прежнему можно завести только на ЛИЧНУЮ схему сотрудника (см.
// resolveTarget ниже): естественный ключ «одна задача на правило за период»
// (config.taskIdByPeriod) физически допускает только ОДНУ задачу на
// правило, что делает выбор "ответственного" среди сотрудников отдела
// произвольным — то же ограничение, что и раньше, просто больше не
// связанное с Bitrix-пользователем.
@CommandHandler(CreateSalaryRuleCommand)
export class CreateSalaryRuleHandler implements ICommandHandler<
    CreateSalaryRuleCommand,
    { id: string }
> {
    constructor(
        @Inject(SALARY_RULE_REPOSITORY)
        protected readonly salaryRuleRepo: SalaryRuleRepositoryPort,
        @Inject(MOTIVATION_SCHEMA_REPOSITORY)
        protected readonly motivationSchemaRepo: MotivationSchemaRepositoryPort,
    ) {}

    async execute(command: CreateSalaryRuleCommand): Promise<{ id: string }> {
        const rule = SalaryRuleFactory.create(command.rule);

        if (rule.type === 'TaskCompletion') {
            await this.assertPersonalSchema(command.motivationSchemaId);
        }

        await this.salaryRuleRepo.insert(rule, {
            motivationSchemaId: command.motivationSchemaId,
        });
        return { id: rule.id };
    }

    // Продуктовое решение (унаследовано без изменений от предыдущей
    // Bitrix-эры): правило TaskCompletion можно завести только на ЛИЧНУЮ
    // схему (MotivationTarget.isEmployee()) — см. WHY у класса выше.
    private async assertPersonalSchema(
        motivationSchemaId: string,
    ): Promise<void> {
        const schema =
            await this.motivationSchemaRepo.findById(motivationSchemaId);
        if (!schema) {
            throw new NotFoundException('Мотивационная схема не найдена');
        }
        if (!this.isPersonalSchema(schema)) {
            throw new TaskCompletionRequiresPersonalSchemaException();
        }
    }

    private isPersonalSchema(schema: MotivationSchema): boolean {
        return schema.getProps().target.isEmployee();
    }
}

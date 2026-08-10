import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { SalesPlanResponse } from 'ireports-contracts';
import { CreateSalesPlanCommand } from './create-sales-plan.command';
import { SalesPlan } from '../../domain/entities/sales-plan.entity';
import { SalesPlanAlreadyExistsException } from '../../domain/exceptions/sales-plan.exception';
import { SALES_PLAN_REPOSITORY } from '../ports/sales-plan.port';
import type { SalesPlanRepositoryPort } from '../ports/sales-plan.port';
import { toSalesPlanResponse } from '../mappers/to-sales-plan-response';

@CommandHandler(CreateSalesPlanCommand)
export class CreateSalesPlanHandler implements ICommandHandler<
    CreateSalesPlanCommand,
    SalesPlanResponse
> {
    constructor(
        @Inject(SALES_PLAN_REPOSITORY)
        private readonly repo: SalesPlanRepositoryPort,
    ) {}

    async execute(command: CreateSalesPlanCommand): Promise<SalesPlanResponse> {
        const category = command.category ?? null;

        // Проверка "на чтение" перед вставкой — дружелюбное сообщение в
        // обычном случае; @@unique в sales.prisma остаётся последней линией
        // защиты от гонки двух параллельных запросов на ту же комбинацию.
        const existing = await this.repo.findByScope(
            command.direction,
            command.department,
            category,
            command.period,
        );
        if (existing) {
            throw new SalesPlanAlreadyExistsException(
                `План на ${command.period} для отдела ${command.department}` +
                    (category !== null ? `, категория ${category}` : '') +
                    ' уже существует',
            );
        }

        // Этот эндпоинт — единственный способ вручную завести план, поэтому
        // source всегда MANUAL. PREVIOUS_MONTH/TEMPLATE проставляет только
        // крон/ленивое достраивание Фазы 4.
        const plan = SalesPlan.create({
            direction: command.direction,
            department: command.department,
            category,
            period: command.period,
            turnover: command.turnover,
            margin: command.margin,
            source: 'MANUAL',
        });

        await this.repo.insert(plan);

        return toSalesPlanResponse(plan);
    }
}

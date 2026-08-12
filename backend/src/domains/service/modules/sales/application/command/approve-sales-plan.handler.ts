import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { SalesPlanResponse } from 'ireports-contracts';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { ApproveSalesPlanCommand } from './approve-sales-plan.command';
import { SalesPlan } from '../../domain/entities/sales-plan.entity';
import { SalesPlanNotFoundException } from '../../domain/exceptions/sales-plan.exception';
import { SALES_PLAN_REPOSITORY } from '../ports/sales-plan.port';
import type { SalesPlanRepositoryPort } from '../ports/sales-plan.port';
import { toSalesPlanResponse } from '../mappers/to-sales-plan-response';

// Утверждает набор строк — построчно (ids) или весь месяц по направлению
// (direction + period). Идемпотентно: строки, уже находящиеся в APPROVED,
// не трогаются (см. SalesPlan.approve() — сам по себе метод идемпотентен,
// но здесь важно не перезаписывать чужое предыдущее утверждение при
// массовом вызове). Возвращает все затронутые строки — и переутверждённые,
// и уже утверждённые ранее, чтобы фронтенд получил актуальное состояние
// месяца одним ответом.
@CommandHandler(ApproveSalesPlanCommand)
export class ApproveSalesPlanHandler implements ICommandHandler<
    ApproveSalesPlanCommand,
    SalesPlanResponse[]
> {
    constructor(
        @Inject(SALES_PLAN_REPOSITORY)
        private readonly repo: SalesPlanRepositoryPort,
    ) {}

    async execute(
        command: ApproveSalesPlanCommand,
    ): Promise<SalesPlanResponse[]> {
        const targets = await this.resolveTargets(command);

        for (const plan of targets) {
            if (plan.status !== 'APPROVED') {
                plan.approve(command.approvedBy);
                await this.repo.update(plan);
            }
        }

        return targets.map(toSalesPlanResponse);
    }

    private async resolveTargets(
        command: ApproveSalesPlanCommand,
    ): Promise<SalesPlan[]> {
        if (command.ids) {
            const plans = await this.repo.findByIds(command.ids);
            const byId = new Map(plans.map((plan) => [plan.id, plan]));

            // "Не найдено" здесь — и id вообще не существует, и id
            // существует, но принадлежит чужому направлению: план
            // чужого направления для этого запроса не должен быть
            // виден вообще, поэтому он остаётся в missing наравне с
            // отсутствующим, а не утверждается молча. Хотя бы один такой
            // id — весь approve отклоняется, ни одна строка не трогается.
            const missing = command.ids.filter((id) => {
                const plan = byId.get(id);
                return !plan || plan.direction !== command.direction;
            });
            if (missing.length > 0) {
                throw new SalesPlanNotFoundException(
                    `Не найдены строки плана: ${missing.join(', ')}`,
                );
            }
            return plans;
        }

        if (command.period) {
            return this.repo.findByDirectionAndPeriod(
                command.direction,
                command.period,
            );
        }

        throw new ArgumentInvalidException(
            'Нужно указать либо ids, либо направление и период',
        );
    }
}

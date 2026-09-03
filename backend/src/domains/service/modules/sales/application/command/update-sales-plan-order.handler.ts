import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { SalesPlanTemplateResponse } from 'ireports-contracts';
import { UpdateSalesPlanOrderCommand } from './update-sales-plan-order.command';
import { SalesPlanTemplate } from '../../domain/entities/sales-plan-template.entity';
import { SALES_PLAN_TEMPLATE_REPOSITORY } from '../ports/sales-plan-template.port';
import type { SalesPlanTemplateRepositoryPort } from '../ports/sales-plan-template.port';
import { toSalesPlanTemplateResponse } from '../mappers/to-sales-plan-template-response';

// Как и PutSalesPlanTemplateHandler — upsert по естественному ключу
// (direction, department, category): категория, у которой ещё нет строки
// шаблона (например, план на неё заведён напрямую, без предварительной
// правки шаблона), получает новую строку шаблона с нулевыми turnover/
// margin и заданным sortOrder — единственный способ сохранить её позицию,
// раз sortOrder хранится только на SalesPlanTemplate (см. sales.prisma).
// Для уже существующей строки шаблона меняется только sortOrder — через
// entity.reorder(), отдельный от update() метод (см. entity) — turnover/
// margin/orderTypeIds/growthPercent не трогаются вообще.
@CommandHandler(UpdateSalesPlanOrderCommand)
export class UpdateSalesPlanOrderHandler implements ICommandHandler<
    UpdateSalesPlanOrderCommand,
    SalesPlanTemplateResponse[]
> {
    constructor(
        @Inject(SALES_PLAN_TEMPLATE_REPOSITORY)
        private readonly repo: SalesPlanTemplateRepositoryPort,
    ) {}

    // Фаза 4 (docs/sales-plan-row-drag-and-drop-reorder) оставила открытым
    // вопрос "блокировать ли переупорядочивание при закрытом расчётном
    // периоде" — решение: НЕ блокировать (см. симметричное обоснование в
    // UpdateShopSalesPlanOrderHandler направления shop):
    //   1. Ни один другой write-хендлер этого модуля (Create/Update/Delete/
    //      ApproveSalesPlan, PutSalesPlanTemplate) сегодня не проверяет
    //      AccountingPeriod.isClosed() — EnsurePeriodNotClosedService
    //      применяется только к источникам часов (EmployeeHoursEntry/
    //      WorkScheduleEntry). Блокировать именно order было бы
    //      несогласованным исключением из этого.
    //   2. Команда не привязана к конкретному периоду вообще — она меняет
    //      sortOrder на SalesPlanTemplate, период-независимой сущности (не
    //      принимает `period`, см. UpdateSalesPlanOrderCommand), тогда как
    //      "закрыт" бывает только конкретный AccountingPeriod (direction,
    //      period). Сам порядок строк не участвует в расчёте зарплаты, так
    //      что блокировка по какому-то одному периоду не защищала бы ни от
    //      чего, от чего защищает закрытие периода.
    async execute(
        command: UpdateSalesPlanOrderCommand,
    ): Promise<SalesPlanTemplateResponse[]> {
        const results: SalesPlanTemplate[] = [];

        for (const item of command.items) {
            const category = item.category ?? null;
            const existing = await this.repo.findByScope(
                command.direction,
                command.department,
                category,
            );

            if (existing) {
                existing.reorder(item.sortOrder);
                await this.repo.update(existing);
                results.push(existing);
                continue;
            }

            const template = SalesPlanTemplate.create({
                direction: command.direction,
                department: command.department,
                category,
                turnover: 0,
                margin: 0,
                sortOrder: item.sortOrder,
            });
            await this.repo.insert(template);
            results.push(template);
        }

        return results.map(toSalesPlanTemplateResponse);
    }
}

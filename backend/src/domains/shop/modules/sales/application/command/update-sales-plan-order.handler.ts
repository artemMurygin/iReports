import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { SalesPlanTemplateResponse } from 'ireports-contracts';
import { UpdateShopSalesPlanOrderCommand } from './update-sales-plan-order.command';
import { ShopSalesPlanTemplate } from '../../domain/entities/sales-plan-template.entity';
import { SHOP_SALES_PLAN_TEMPLATE_REPOSITORY } from '../ports/sales-plan-template.port';
import type { ShopSalesPlanTemplateRepositoryPort } from '../ports/sales-plan-template.port';
import { toShopSalesPlanTemplateResponse } from '../mappers/to-sales-plan-template-response';

// Зеркало domains/service/modules/sales/application/command/
// update-sales-plan-order.handler.ts (Фаза 1, docs/
// sales-plan-row-drag-and-drop-reorder) — независимая реализация
// направления shop. Как и PutShopSalesPlanTemplateHandler — upsert по
// естественному ключу (department, category): категория, у которой ещё
// нет строки шаблона, получает новую строку с нулевыми turnover/margin и
// заданным sortOrder — единственный способ сохранить её позицию, раз
// sortOrder хранится только на ShopSalesPlanTemplate (см. sales.prisma, та
// же общая таблица, что и у service, с дискриминатором direction). Для уже
// существующей строки шаблона меняется только sortOrder — через
// entity.reorder(), отдельный от update() метод — turnover/margin/
// orderTypeIds/growthPercent не трогаются вообще.
@CommandHandler(UpdateShopSalesPlanOrderCommand)
export class UpdateShopSalesPlanOrderHandler implements ICommandHandler<
    UpdateShopSalesPlanOrderCommand,
    SalesPlanTemplateResponse[]
> {
    constructor(
        @Inject(SHOP_SALES_PLAN_TEMPLATE_REPOSITORY)
        private readonly repo: ShopSalesPlanTemplateRepositoryPort,
    ) {}

    // Фаза 4 (docs/sales-plan-row-drag-and-drop-reorder) оставила открытым
    // вопрос "блокировать ли переупорядочивание при закрытом расчётном
    // периоде" — решение: НЕ блокировать, по двум независимым причинам:
    //   1. Ни один другой write-хендлер этого модуля (Create/Update/Delete/
    //      ApproveSalesPlan, PutSalesPlanTemplate — ни в domains/service,
    //      ни здесь, в domains/shop) сегодня не проверяет
    //      AccountingPeriod.isClosed() вообще — EnsurePeriodNotClosedService
    //      применяется только к источникам часов (EmployeeHoursEntry/
    //      WorkScheduleEntry, см. domains/service/modules/accounting и
    //      modules/work-schedule). Блокировать именно order было бы
    //      несогласованным исключением, а не следованием существующему
    //      поведению остального плана продаж.
    //   2. Команда концептуально не привязана к конкретному периоду: она
    //      меняет sortOrder на ShopSalesPlanTemplate — период-независимой
    //      сущности (не принимает `period` вообще, см.
    //      UpdateShopSalesPlanOrderCommand) — тогда как "закрыт" бывает
    //      только конкретный AccountingPeriod (direction, period). Порядок
    //      строк общий для всех периодов сразу; блокировка по периоду X не
    //      имела бы естественного смысла и не защищала бы от того, от чего
    //      защищает закрытие периода (искажение уже посчитанной/
    //      зафиксированной суммы) — сам порядок не участвует в расчёте
    //      зарплаты.
    async execute(
        command: UpdateShopSalesPlanOrderCommand,
    ): Promise<SalesPlanTemplateResponse[]> {
        const results: ShopSalesPlanTemplate[] = [];

        for (const item of command.items) {
            const category = item.category ?? null;
            const existing = await this.repo.findByScope(
                command.department,
                category,
            );

            if (existing) {
                existing.reorder(item.sortOrder);
                await this.repo.update(existing);
                results.push(existing);
                continue;
            }

            const template = ShopSalesPlanTemplate.create({
                department: command.department,
                category,
                turnover: 0,
                margin: 0,
                sortOrder: item.sortOrder,
            });
            await this.repo.insert(template);
            results.push(template);
        }

        return results.map(toShopSalesPlanTemplateResponse);
    }
}

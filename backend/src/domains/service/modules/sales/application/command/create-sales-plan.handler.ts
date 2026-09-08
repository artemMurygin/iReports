import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { SalesPlanResponse } from 'ireports-contracts';
import { CreateSalesPlanCommand } from './create-sales-plan.command';
import { SalesPlan } from '../../domain/entities/sales-plan.entity';
import { SalesPlanAlreadyExistsException } from '../../domain/exceptions/sales-plan.exception';
import { SALES_PLAN_REPOSITORY } from '../ports/sales-plan.port';
import type { SalesPlanRepositoryPort } from '../ports/sales-plan.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import { toSalesPlanResponse } from '../mappers/to-sales-plan-response';

@CommandHandler(CreateSalesPlanCommand)
export class CreateSalesPlanHandler implements ICommandHandler<
    CreateSalesPlanCommand,
    SalesPlanResponse[]
> {
    constructor(
        @Inject(SALES_PLAN_REPOSITORY)
        private readonly repo: SalesPlanRepositoryPort,
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
    ) {}

    async execute(
        command: CreateSalesPlanCommand,
    ): Promise<SalesPlanResponse[]> {
        // Дубли внутри самого запроса (одна и та же комбинация
        // (direction, department, category, period) дважды в массиве)
        // отклоняются целиком, до единого обращения к репозиторию — иначе
        // первое вхождение успело бы вставиться прежде, чем второе
        // обнаружит конфликт.
        this.assertNoDuplicatesWithinRequest(command.direction, command.plans);

        // Все строки батча создаются атомарно: если хоть одна конфликтует с
        // уже существующей в БД строкой, не создаётся ни одна — реальный
        // rollback обеспечивает транзакция UNIT_OF_WORK (см.
        // CreateMotivationSchemaHandler в соседнем модуле accounting за тем
        // же приёмом), эта функция лишь оборачивает работу в неё.
        // Одиночное создание — частный случай батча из одного элемента,
        // отдельной ветки под него нет.
        return this.unitOfWork.run(async () => {
            const created: SalesPlanResponse[] = [];

            for (const item of command.plans) {
                const category = item.category ?? null;

                // Проверка "на чтение" перед вставкой — дружелюбное сообщение
                // в обычном случае; @@unique в sales.prisma остаётся
                // последней линией защиты от гонки двух параллельных
                // запросов на ту же комбинацию.
                const existing = await this.repo.findByScope(
                    command.direction,
                    item.department,
                    category,
                    item.period,
                );
                if (existing) {
                    throw new SalesPlanAlreadyExistsException(
                        `План на ${item.period} для отдела ${item.department}` +
                            (category !== null
                                ? `, категория ${category}`
                                : '') +
                            ' уже существует',
                    );
                }

                // Этот эндпоинт — единственный способ вручную завести план,
                // поэтому source всегда MANUAL. PREVIOUS_MONTH/TEMPLATE
                // проставляет только крон/ленивое достраивание Фазы 4.
                const plan = SalesPlan.create({
                    direction: command.direction,
                    department: item.department,
                    category,
                    period: item.period,
                    turnover: item.turnover,
                    margin: item.margin,
                    orderTypeIds: item.orderTypeIds,
                    source: 'MANUAL',
                });

                await this.repo.insert(plan);
                created.push(toSalesPlanResponse(plan));
            }

            return created;
        });
    }

    private assertNoDuplicatesWithinRequest(
        direction: CreateSalesPlanCommand['direction'],
        plans: CreateSalesPlanCommand['plans'],
    ): void {
        const seen = new Set<string>();
        for (const item of plans) {
            const category = item.category ?? null;
            const scopeKey = [
                direction,
                item.department,
                category,
                item.period,
            ].join(':');

            if (seen.has(scopeKey)) {
                throw new SalesPlanAlreadyExistsException(
                    `План на ${item.period} для отдела ${item.department}` +
                        (category !== null ? `, категория ${category}` : '') +
                        ' указан в запросе более одного раза',
                );
            }
            seen.add(scopeKey);
        }
    }
}

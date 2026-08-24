import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { ErpCashConfigResponse } from 'ireports-contracts';
import { PutErpCashConfigCommand } from './put-erp-cash-config.command';
import { ErpCashConfig } from '../../domain/entities/erp-cash-config.entity';
import { ERP_CASH_CONFIG_REPOSITORY } from '../ports/erp-cash-config.port';
import type { ErpCashConfigRepositoryPort } from '../ports/erp-cash-config.port';
import { toErpCashConfigResponse } from '../mappers/to-erp-cash-config-response';

// PUT — upsert по direction (естественный ключ): первая правка направления
// создаёт строку конфигурации, повторная — правит уже существующую (тот же
// приём, что PutSalesPlanTemplateHandler).
@CommandHandler(PutErpCashConfigCommand)
export class PutErpCashConfigHandler implements ICommandHandler<
    PutErpCashConfigCommand,
    ErpCashConfigResponse
> {
    constructor(
        @Inject(ERP_CASH_CONFIG_REPOSITORY)
        private readonly repo: ErpCashConfigRepositoryPort,
    ) {}

    async execute(
        command: PutErpCashConfigCommand,
    ): Promise<ErpCashConfigResponse> {
        const patch = {
            roappCashboxId: command.roappCashboxId,
            moySkladExpenseItemId: command.moySkladExpenseItemId,
            moySkladIncomeItemId: command.moySkladIncomeItemId,
            organizationId: command.organizationId,
        };
        const existing = await this.repo.findByDirection(command.direction);

        if (existing) {
            existing.update(patch);
            await this.repo.save(existing);
            return toErpCashConfigResponse(existing, command.direction);
        }

        const config = ErpCashConfig.create({
            direction: command.direction,
            ...patch,
        });
        await this.repo.save(config);
        return toErpCashConfigResponse(config, command.direction);
    }
}

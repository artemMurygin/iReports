import { Inject } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { AccrueSalaryAccrualDocumentResponse } from 'ireports-contracts';
import { SHOP_SALARY_ACCRUAL_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-salary-accrual.port';
import type { ShopSalaryAccrualRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-salary-accrual.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import {
    ShopSalaryAccrualNotFoundException,
    ShopSalaryAccrualPaidException,
} from '@/domains/shop/modules/accounting/domain/exceptions/shop-salary-accrual.exception';
import {
    toShopSalaryAccrualResponse,
    unknownShopEmployeeInfo,
} from '../mappers/to-shop-salary-accrual-response';
import { resolveShopEmployees } from '../services/list-shop-salary-accruals.service';
import { accrueShopDraftLines } from './accrue-shop-draft-lines.helper';
import { AccrueShopSalaryAccrualDocumentCommand } from './accrue-shop-salary-accrual-document.command';

// Зеркало domains/service/modules/accounting/application/command/
// accrue-salary-accrual-document.handler.ts (Фаза 6 docs/service-shop-boundary-violations-fix)
// — независимый хендлер для направления shop.
@CommandHandler(AccrueShopSalaryAccrualDocumentCommand)
export class AccrueShopSalaryAccrualDocumentHandler implements ICommandHandler<
    AccrueShopSalaryAccrualDocumentCommand,
    AccrueSalaryAccrualDocumentResponse
> {
    constructor(
        @Inject(SHOP_SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: ShopSalaryAccrualRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
        private readonly commandBus: CommandBus,
    ) {}

    async execute(
        command: AccrueShopSalaryAccrualDocumentCommand,
    ): Promise<AccrueSalaryAccrualDocumentResponse> {
        const accrual = await this.accrualRepo.findById(command.accrualId);
        if (!accrual) {
            throw new ShopSalaryAccrualNotFoundException(command.accrualId);
        }
        if (accrual.isPaid()) {
            throw new ShopSalaryAccrualPaidException(accrual.id);
        }

        const employees = await resolveShopEmployees(this.directoryRepo);
        const { failures } = await accrueShopDraftLines(
            this.commandBus,
            accrual,
            command.accruedBy,
            employees,
        );

        const updated = await this.accrualRepo.findById(command.accrualId);
        return {
            accrual: toShopSalaryAccrualResponse(
                updated ?? accrual,
                employees.get(accrual.employeeId) ??
                    unknownShopEmployeeInfo(accrual.employeeId),
            ),
            failures,
        };
    }
}

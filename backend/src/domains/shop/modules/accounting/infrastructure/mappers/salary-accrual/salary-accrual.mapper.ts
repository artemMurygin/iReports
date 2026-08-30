import type {
    SalaryAccrual as SalaryAccrualContract,
    SalaryAccrualLine as SalaryAccrualLineContract,
    SalaryAccrualResponse,
    TargetRole,
} from 'ireports-contracts';
import {
    Prisma,
    SalaryAccrual as SalaryAccrualRecord,
    SalaryAccrualLine as SalaryAccrualLineRecord,
    SalaryAccrualLineAdjustment as SalaryAccrualLineAdjustmentRecord,
} from '../../../../../../../../prisma/generated/prisma/schema/client';
import { Period } from '@/shared/domain/period.value-object';
import type { CalculationSourceRef } from '@/shared/domain/calculation-line';
import { ShopSalaryAccrual } from '@/domains/shop/modules/accounting/domain/entities/salary-accrual/salary-accrual.entity';
import { ShopSalaryAccrualLine } from '@/domains/shop/modules/accounting/domain/entities/salary-accrual/salary-accrual-line.entity';
import { ShopSalaryAccrualLineAdjustment } from '@/domains/shop/modules/accounting/domain/entities/salary-accrual/salary-accrual-line-adjustment.entity';

// ФИО и отдел документ не хранит (только employeeId) — резолвятся на чтении
// из справочника Bitrix (modules/directory), тем же приёмом и с тем же
// фолбэком, что и target.name в ShopMotivationSchemaMapper.toListItemResponse.
export interface ShopSalaryAccrualEmployeeInfo {
    name: string;
    departmentId: number | null;
}

export type ShopSalaryAccrualRecordWithLines = SalaryAccrualRecord & {
    lines: (SalaryAccrualLineRecord & {
        adjustments: SalaryAccrualLineAdjustmentRecord[];
    })[];
};

export interface ShopSalaryAccrualPersistence {
    accrual: Prisma.SalaryAccrualCreateManyInput;
    lines: Prisma.SalaryAccrualLineCreateManyInput[];
}

// Зеркало domains/service/modules/accounting/infrastructure/mappers/
// salary-accrual.mapper.ts (Фаза 6 docs/service-shop-boundary-violations-fix)
// — независимая копия для направления shop. Таблицы salary_accruals/
// salary_accrual_lines/salary_accrual_line_adjustments общие для обоих
// доменов (дискриминатор direction на salary_accruals) — здесь direction
// подставляется фиксированным 'shop' в toPersistence(), toDomain() его
// намеренно не читает (см. тот же приём у ShopAccountingPeriodMapper):
// строки этого направления и так фильтруются ShopSalaryAccrualRepository.
export class ShopSalaryAccrualMapper {
    toDomain(record: ShopSalaryAccrualRecordWithLines): ShopSalaryAccrual {
        const lines = [...record.lines]
            .sort((a, b) => a.position - b.position)
            .map(
                (line) =>
                    new ShopSalaryAccrualLine({
                        id: line.id,
                        createdAt: line.createdAt,
                        updatedAt: line.updatedAt,
                        props: {
                            position: line.position,
                            ruleId: line.ruleId,
                            type: line.type,
                            name: line.name,
                            targetRole: line.targetRole,
                            salaryBasis: line.salaryBasis ?? undefined,
                            quantity: line.quantity ?? undefined,
                            rate: line.rate ?? undefined,
                            originalAmount: line.originalAmount,
                            amount: line.amount,
                            sources:
                                line.sources as unknown as CalculationSourceRef[],
                            status: line.status,
                            adjustments: [...line.adjustments]
                                .sort(
                                    (a, b) =>
                                        a.createdAt.getTime() -
                                        b.createdAt.getTime(),
                                )
                                .map(
                                    (adjustment) =>
                                        new ShopSalaryAccrualLineAdjustment({
                                            id: adjustment.id,
                                            createdAt: adjustment.createdAt,
                                            updatedAt: adjustment.createdAt,
                                            props: {
                                                previousAmount:
                                                    adjustment.previousAmount,
                                                newAmount: adjustment.newAmount,
                                                comment: adjustment.comment,
                                                adjustedBy:
                                                    adjustment.adjustedBy,
                                            },
                                        }),
                                ),
                        },
                    }),
            );
        return new ShopSalaryAccrual({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            props: {
                period: Period.create(record.period),
                employeeId: record.employeeId,
                status: record.status,
                isDismissed: record.isDismissed,
                total: record.total,
                lines,
            },
        });
    }

    toPersistence(entity: ShopSalaryAccrual): ShopSalaryAccrualPersistence {
        const props = entity.getProps();
        return {
            accrual: {
                id: entity.id,
                direction: 'shop',
                period: entity.period,
                employeeId: entity.employeeId,
                status: entity.status,
                isDismissed: entity.isDismissed,
                total: entity.total,
                createdAt: props.createdAt,
                updatedAt: props.updatedAt,
            },
            lines: entity.lines.map((line) => {
                const lineProps = line.getProps();
                return {
                    id: line.id,
                    accrualId: entity.id,
                    position: line.position,
                    ruleId: line.ruleId,
                    type: line.type,
                    name: line.name,
                    targetRole: line.targetRole,
                    salaryBasis: line.salaryBasis ?? null,
                    quantity: line.quantity ?? null,
                    rate: line.rate ?? null,
                    originalAmount: line.originalAmount,
                    amount: line.amount,
                    sources: line.sources as unknown as Prisma.InputJsonValue,
                    status: line.status,
                    createdAt: lineProps.createdAt,
                    updatedAt: lineProps.updatedAt,
                };
            }),
        };
    }

    adjustmentsToPersistence(
        entity: ShopSalaryAccrual,
    ): Prisma.SalaryAccrualLineAdjustmentCreateManyInput[] {
        return entity.lines.flatMap((line) =>
            line.adjustments.map((adjustment) => ({
                id: adjustment.id,
                lineId: line.id,
                previousAmount: adjustment.previousAmount,
                newAmount: adjustment.newAmount,
                comment: adjustment.comment,
                adjustedBy: adjustment.adjustedBy,
                createdAt: adjustment.createdAt,
            })),
        );
    }

    static unknownEmployeeInfo(
        employeeId: number,
    ): ShopSalaryAccrualEmployeeInfo {
        return { name: `Неизвестно (id: ${employeeId})`, departmentId: null };
    }

    toListItemResponse(
        entity: ShopSalaryAccrual,
        employee: ShopSalaryAccrualEmployeeInfo,
    ): SalaryAccrualContract {
        return {
            id: entity.id,
            direction: entity.direction,
            period: entity.period,
            employeeId: entity.employeeId,
            employeeName: employee.name,
            departmentId: employee.departmentId,
            status: entity.status,
            isDismissed: entity.isDismissed,
            total: entity.total,
            linesCount: entity.lines.length,
            accruedLinesCount: entity.accruedLinesCount,
            createdAt: entity.createdAt,
        };
    }

    toDetailResponse(
        entity: ShopSalaryAccrual,
        employee: ShopSalaryAccrualEmployeeInfo,
    ): SalaryAccrualResponse {
        return {
            ...this.toListItemResponse(entity, employee),
            lines: entity.lines.map((line) => this.toLineResponse(line)),
        };
    }

    private toLineResponse(
        line: ShopSalaryAccrualLine,
    ): SalaryAccrualLineContract {
        return {
            id: line.id,
            ruleId: line.ruleId,
            type: line.type,
            name: line.name,
            targetRole: line.targetRole as TargetRole,
            salaryBasis: line.salaryBasis,
            quantity: line.quantity,
            rate: line.rate,
            originalAmount: line.originalAmount,
            amount: line.amount,
            sources: line.sources,
            status: line.status,
            adjustmentComment: line.adjustmentComment ?? null,
        };
    }
}

import {
    Prisma,
    SalaryAccrual as SalaryAccrualRecord,
    SalaryAccrualLine as SalaryAccrualLineRecord,
    SalaryAccrualLineAdjustment as SalaryAccrualLineAdjustmentRecord,
} from '../../../../../../../prisma/generated/prisma/schema/client';
import { Period } from '@/shared/domain/period.value-object';
import type { CalculationSourceRef } from '@/shared/domain/calculation-line';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual.entity';
import { SalaryAccrualLine } from '@/domains/service/modules/accounting/domain/entities/salary-accrual-line.entity';
import { SalaryAccrualLineAdjustment } from '@/domains/service/modules/accounting/domain/entities/salary-accrual-line-adjustment.entity';

export type SalaryAccrualRecordWithLines = SalaryAccrualRecord & {
    lines: (SalaryAccrualLineRecord & {
        adjustments: SalaryAccrualLineAdjustmentRecord[];
    })[];
};

export interface SalaryAccrualPersistence {
    accrual: Prisma.SalaryAccrualCreateManyInput;
    lines: Prisma.SalaryAccrualLineCreateManyInput[];
}

// Документ + строки записываются двумя createMany (шапки и строки всех
// документов закрытия батчами), поэтому toPersistence отдаёт не вложенный
// CreateInput, а пару плоских CreateManyInput — см.
// SalaryAccrualRepository.saveAll.
export class SalaryAccrualMapper {
    toDomain(record: SalaryAccrualRecordWithLines): SalaryAccrual {
        const lines = [...record.lines]
            .sort((a, b) => a.position - b.position)
            .map(
                (line) =>
                    new SalaryAccrualLine({
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
                                        new SalaryAccrualLineAdjustment({
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
        return new SalaryAccrual({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            props: {
                direction: record.direction,
                period: Period.create(record.period),
                employeeId: record.employeeId,
                status: record.status,
                isDismissed: record.isDismissed,
                total: record.total,
                lines,
            },
        });
    }

    toPersistence(entity: SalaryAccrual): SalaryAccrualPersistence {
        const props = entity.getProps();
        return {
            accrual: {
                id: entity.id,
                direction: entity.direction,
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

    // Все записи истории корректировок документа плоским списком — save()
    // пишет их через createMany({ skipDuplicates: true }): уже
    // сохранённые записи (тот же id) пропускаются, новые добавляются;
    // корректировка неизменяема, обновлять существующие не нужно.
    adjustmentsToPersistence(
        entity: SalaryAccrual,
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
}

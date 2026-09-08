import { AccountingCacheFreshness } from './accounting-cache-freshness';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';
import { MotivationTarget } from '@/domains/service/modules/accounting/domain/value-objects/motivation-target.value-object';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { withRequestContext } from '@/shared/testing/with-request-context';

describe('AccountingCacheFreshness', () => {
    describe('schemaVersion', () => {
        it("возвращает 'none' для отсутствующей схемы", () => {
            expect(AccountingCacheFreshness.schemaVersion(null)).toBe('none');
        });

        it('возвращает updatedAt схемы, если он позже правил', () => {
            const schemaUpdatedAt = new Date('2026-08-05T00:00:00.000Z');
            const ruleUpdatedAt = new Date('2026-08-01T00:00:00.000Z');
            const schema = buildSchema(schemaUpdatedAt, ruleUpdatedAt);

            expect(AccountingCacheFreshness.schemaVersion(schema)).toBe(
                schemaUpdatedAt.toISOString(),
            );
        });

        it('возвращает updatedAt правила, если он позже схемы (правка правила)', () => {
            const schemaUpdatedAt = new Date('2026-08-01T00:00:00.000Z');
            const ruleUpdatedAt = new Date('2026-08-05T00:00:00.000Z');
            const schema = buildSchema(schemaUpdatedAt, ruleUpdatedAt);

            expect(AccountingCacheFreshness.schemaVersion(schema)).toBe(
                ruleUpdatedAt.toISOString(),
            );
        });
    });

    describe('dateStamp', () => {
        it("возвращает 'never' для null", () => {
            expect(AccountingCacheFreshness.dateStamp(null)).toBe('never');
        });

        it('возвращает ISO-строку даты', () => {
            const at = new Date('2026-08-05T00:00:00.000Z');
            expect(AccountingCacheFreshness.dateStamp(at)).toBe(
                at.toISOString(),
            );
        });
    });

    describe('buildStamp', () => {
        it('меняется при изменении любой из трёх составляющих', () => {
            const base = AccountingCacheFreshness.buildStamp({
                schemaVersion: 'v1',
                domainSyncStamp: 's1',
                salesPlanStamp: 'p1',
            });

            expect(
                AccountingCacheFreshness.buildStamp({
                    schemaVersion: 'v2',
                    domainSyncStamp: 's1',
                    salesPlanStamp: 'p1',
                }),
            ).not.toBe(base);
            expect(
                AccountingCacheFreshness.buildStamp({
                    schemaVersion: 'v1',
                    domainSyncStamp: 's2',
                    salesPlanStamp: 'p1',
                }),
            ).not.toBe(base);
            expect(
                AccountingCacheFreshness.buildStamp({
                    schemaVersion: 'v1',
                    domainSyncStamp: 's1',
                    salesPlanStamp: 'p2',
                }),
            ).not.toBe(base);
        });

        it('совпадает при одинаковых составляющих', () => {
            const parts = {
                schemaVersion: 'v1',
                domainSyncStamp: 's1',
                salesPlanStamp: 'p1',
            };
            expect(AccountingCacheFreshness.buildStamp(parts)).toBe(
                AccountingCacheFreshness.buildStamp(parts),
            );
        });
    });
});

function buildSchema(
    schemaUpdatedAt: Date,
    ruleUpdatedAt: Date,
): MotivationSchema {
    return withRequestContext(() => {
        const rule = new PayPerHoursEntity({
            id: 'rule-1',
            createdAt: ruleUpdatedAt,
            updatedAt: ruleUpdatedAt,
            props: {
                name: 'Почасовая ставка',
                type: 'PayPerHour',
                targetRole: 'ENGINEER',
                config: { price: 250 },
            },
        });
        return new MotivationSchema({
            id: 'schema-1',
            createdAt: schemaUpdatedAt,
            updatedAt: schemaUpdatedAt,
            props: {
                target: MotivationTarget.create('Employee', 42),
                name: 'Схема',
                rules: [rule],
            },
        });
    });
}

import {
    buildFreshnessStamp,
    motivationSchemaVersion,
    stampOf,
} from './accounting-cache-freshness';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { MotivationTarget } from '@/domains/service/modules/accounting/domain/value-objects/motivation-target.value-object';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { withRequestContext } from '@/shared/testing/with-request-context';

describe('accounting-cache-freshness', () => {
    describe('motivationSchemaVersion', () => {
        it("возвращает 'none' для отсутствующей схемы", () => {
            expect(motivationSchemaVersion(null)).toBe('none');
        });

        it('возвращает updatedAt схемы, если он позже правил', () => {
            const schemaUpdatedAt = new Date('2026-08-05T00:00:00.000Z');
            const ruleUpdatedAt = new Date('2026-08-01T00:00:00.000Z');
            const schema = buildSchema(schemaUpdatedAt, ruleUpdatedAt);

            expect(motivationSchemaVersion(schema)).toBe(
                schemaUpdatedAt.toISOString(),
            );
        });

        it('возвращает updatedAt правила, если он позже схемы (правка правила)', () => {
            const schemaUpdatedAt = new Date('2026-08-01T00:00:00.000Z');
            const ruleUpdatedAt = new Date('2026-08-05T00:00:00.000Z');
            const schema = buildSchema(schemaUpdatedAt, ruleUpdatedAt);

            expect(motivationSchemaVersion(schema)).toBe(
                ruleUpdatedAt.toISOString(),
            );
        });
    });

    describe('stampOf', () => {
        it("возвращает 'never' для null", () => {
            expect(stampOf(null)).toBe('never');
        });

        it('возвращает ISO-строку даты', () => {
            const at = new Date('2026-08-05T00:00:00.000Z');
            expect(stampOf(at)).toBe(at.toISOString());
        });
    });

    describe('buildFreshnessStamp', () => {
        it('меняется при изменении любой из трёх составляющих', () => {
            const base = buildFreshnessStamp({
                motivationSchemaVersion: 'v1',
                domainSyncStamp: 's1',
                salesPlanStamp: 'p1',
            });

            expect(
                buildFreshnessStamp({
                    motivationSchemaVersion: 'v2',
                    domainSyncStamp: 's1',
                    salesPlanStamp: 'p1',
                }),
            ).not.toBe(base);
            expect(
                buildFreshnessStamp({
                    motivationSchemaVersion: 'v1',
                    domainSyncStamp: 's2',
                    salesPlanStamp: 'p1',
                }),
            ).not.toBe(base);
            expect(
                buildFreshnessStamp({
                    motivationSchemaVersion: 'v1',
                    domainSyncStamp: 's1',
                    salesPlanStamp: 'p2',
                }),
            ).not.toBe(base);
        });

        it('совпадает при одинаковых составляющих', () => {
            const parts = {
                motivationSchemaVersion: 'v1',
                domainSyncStamp: 's1',
                salesPlanStamp: 'p1',
            };
            expect(buildFreshnessStamp(parts)).toBe(buildFreshnessStamp(parts));
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

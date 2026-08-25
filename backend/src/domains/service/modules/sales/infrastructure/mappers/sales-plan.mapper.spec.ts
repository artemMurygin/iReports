import {
    SalesPlanMapper,
    NO_CATEGORY_ID,
    categoryToDomain,
    categoryToPersistence,
} from './sales-plan.mapper';
import { SalesPlan } from '@/domains/service/modules/sales/domain/entities/sales-plan.entity';
import { withRequestContext } from '@/shared/testing/with-request-context';

describe('SalesPlanMapper', () => {
    const mapper = new SalesPlanMapper();
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const updatedAt = new Date('2026-01-02T00:00:00.000Z');

    describe('категория ↔ сентинел', () => {
        it("NO_CATEGORY_ID ('') в БД соответствует category = null в домене", () => {
            expect(categoryToDomain(NO_CATEGORY_ID)).toBeNull();
            expect(categoryToPersistence(null)).toBe(NO_CATEGORY_ID);
        });

        it('реальный ID категории проходит без изменений в обе стороны', () => {
            expect(categoryToDomain('42')).toBe('42');
            expect(categoryToPersistence('42')).toBe('42');
        });
    });

    describe('toDomain', () => {
        it('восстанавливает план без категории и без утверждения', () => {
            const plan = mapper.toDomain({
                id: 'plan-1',
                direction: 'service',
                departmentId: 1,
                categoryId: NO_CATEGORY_ID,
                period: '2026-08',
                turnover: 1_000_000,
                margin: 200_000,
                orderTypeIds: [],
                source: 'MANUAL',
                status: 'CREATED',
                approvedBy: null,
                approvedAt: null,
                createdAt,
                updatedAt,
            });

            expect(plan).toBeInstanceOf(SalesPlan);
            expect(plan.category).toBeNull();
            expect(plan.approvedBy).toBeNull();
            expect(plan.approvedAt).toBeNull();
            expect(plan.orderTypeIds).toEqual([]);
        });

        it('восстанавливает утверждённый план вместе с approvedBy/approvedAt', () => {
            const approvedAt = new Date('2026-08-05T10:00:00.000Z');
            const plan = mapper.toDomain({
                id: 'plan-2',
                direction: 'service',
                departmentId: 1,
                categoryId: '7',
                period: '2026-08',
                turnover: 1_000_000,
                margin: 200_000,
                orderTypeIds: [1, 2],
                source: 'PREVIOUS_MONTH',
                status: 'APPROVED',
                approvedBy: 42,
                approvedAt,
                createdAt,
                updatedAt,
            });

            expect(plan.category).toBe('7');
            expect(plan.status).toBe('APPROVED');
            expect(plan.approvedBy).toBe(42);
            expect(plan.approvedAt).toEqual(approvedAt);
            expect(plan.orderTypeIds).toEqual([1, 2]);
        });
    });

    describe('toPersistence', () => {
        it('сериализует план без категории с сентинелом NO_CATEGORY_ID', () => {
            withRequestContext(() => {
                const plan = SalesPlan.create({
                    direction: 'service',
                    department: 1,
                    period: '2026-08',
                    turnover: 1_000_000,
                    margin: 200_000,
                    source: 'MANUAL',
                });

                const record = mapper.toPersistence(plan);

                expect(record).toMatchObject({
                    id: plan.id,
                    direction: 'service',
                    categoryId: NO_CATEGORY_ID,
                    period: '2026-08',
                    turnover: 1_000_000,
                    margin: 200_000,
                    orderTypeIds: [],
                    source: 'MANUAL',
                    status: 'CREATED',
                    approvedBy: null,
                    approvedAt: null,
                });
                expect(record.department).toEqual({ connect: { id: 1 } });
            });
        });

        it('сериализует явно выбранные типы заказов', () => {
            withRequestContext(() => {
                const plan = SalesPlan.create({
                    direction: 'service',
                    department: 1,
                    period: '2026-08',
                    turnover: 1_000_000,
                    margin: 200_000,
                    orderTypeIds: [3, 5],
                    source: 'MANUAL',
                });

                const record = mapper.toPersistence(plan);

                expect(record.orderTypeIds).toEqual([3, 5]);
            });
        });
    });
});

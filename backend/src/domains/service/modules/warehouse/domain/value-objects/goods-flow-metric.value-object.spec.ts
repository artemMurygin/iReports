import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { GoodsFlowMetric } from './goods-flow-metric.value-object';

describe('GoodsFlowMetric', () => {
    describe('create', () => {
        it('создаёт метрику с положительными количеством и суммой', () => {
            const metric = GoodsFlowMetric.create(3, 15_000);

            expect(metric.quantity).toBe(3);
            expect(metric.sum).toBe(15_000);
        });

        it('допускает нулевые количество и сумму (категория без движения)', () => {
            const metric = GoodsFlowMetric.create(0, 0);

            expect(metric.quantity).toBe(0);
            expect(metric.sum).toBe(0);
        });

        it('отклоняет отрицательное количество', () => {
            withRequestContext(() => {
                expect(() => GoodsFlowMetric.create(-1, 100)).toThrow(
                    ArgumentInvalidException,
                );
            });
        });

        it('отклоняет отрицательную сумму', () => {
            withRequestContext(() => {
                expect(() => GoodsFlowMetric.create(1, -100)).toThrow(
                    ArgumentInvalidException,
                );
            });
        });

        it('отклоняет нецелое количество', () => {
            withRequestContext(() => {
                expect(() => GoodsFlowMetric.create(1.5, 100)).toThrow(
                    ArgumentInvalidException,
                );
            });
        });

        it('отклоняет нецелую сумму', () => {
            withRequestContext(() => {
                expect(() => GoodsFlowMetric.create(1, 100.5)).toThrow(
                    ArgumentInvalidException,
                );
            });
        });
    });

    describe('zero', () => {
        it('создаёт нулевую метрику', () => {
            const metric = GoodsFlowMetric.zero();

            expect(metric.quantity).toBe(0);
            expect(metric.sum).toBe(0);
        });
    });

    describe('equals', () => {
        it('равны метрики с одинаковыми quantity/sum', () => {
            expect(
                GoodsFlowMetric.create(3, 15_000).equals(
                    GoodsFlowMetric.create(3, 15_000),
                ),
            ).toBe(true);
        });

        it('не равны метрики с разной суммой', () => {
            expect(
                GoodsFlowMetric.create(3, 15_000).equals(
                    GoodsFlowMetric.create(3, 16_000),
                ),
            ).toBe(false);
        });

        it('не равны метрики с разным количеством', () => {
            expect(
                GoodsFlowMetric.create(3, 15_000).equals(
                    GoodsFlowMetric.create(4, 15_000),
                ),
            ).toBe(false);
        });
    });

    describe('immutability', () => {
        it('не позволяет изменить props извне (unpack возвращает заморозенную копию)', () => {
            const metric = GoodsFlowMetric.create(3, 15_000);
            const unpacked = metric.unpack();

            expect(Object.isFrozen(unpacked)).toBe(true);
            expect(() => {
                (unpacked as { quantity: number }).quantity = 99;
            }).toThrow();
            expect(metric.quantity).toBe(3);
        });
    });
});

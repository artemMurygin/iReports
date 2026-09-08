import { ArgumentInvalidException } from '@/shared/exceptions';
import { Period } from '@/shared/domain/period.value-object';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { Money } from '../../value-objects/money.value-object';
import { GoodsTurnoverReportLine } from './goods-turnover-report-line.entity';

const validCreateProps = {
    period: Period.create('2026-08'),
    categoryId: 'category-1',
    warehouseId: 'warehouse-1',
    turnoverQuantity: 10,
    turnoverSum: Money.ofKopecks(150000),
    stockQuantity: 5,
    stockSum: Money.ofKopecks(75000),
};

describe('GoodsTurnoverReportLine', () => {
    // FR: architecture.md/design.md D7.2 of shop-turnover-report — строка
    // отчёта хранит период, категорию, склад, оборот и остаток.
    it('создаётся с валидными данными', () => {
        const line = GoodsTurnoverReportLine.create(validCreateProps);

        expect(line.period.getValue()).toBe('2026-08');
        expect(line.categoryId).toBe('category-1');
        expect(line.warehouseId).toBe('warehouse-1');
        expect(line.turnoverQuantity).toBe(10);
        expect(line.turnoverSum.getValue()).toBe(150000);
        expect(line.stockQuantity).toBe(5);
        expect(line.stockSum.getValue()).toBe(75000);
    });

    it('бросает исключение при неверном формате периода', () => {
        withRequestContext(() => {
            expect(() => Period.create('2026-13')).toThrow(
                ArgumentInvalidException,
            );
        });
    });

    it('бросает исключение при отрицательном turnoverQuantity', () => {
        withRequestContext(() => {
            expect(() =>
                GoodsTurnoverReportLine.create({
                    ...validCreateProps,
                    turnoverQuantity: -1,
                }),
            ).toThrow(ArgumentInvalidException);
        });
    });

    it('бросает исключение при отрицательном stockQuantity', () => {
        withRequestContext(() => {
            expect(() =>
                GoodsTurnoverReportLine.create({
                    ...validCreateProps,
                    stockQuantity: -1,
                }),
            ).toThrow(ArgumentInvalidException);
        });
    });

    it('бросает исключение при пустом categoryId', () => {
        withRequestContext(() => {
            expect(() =>
                GoodsTurnoverReportLine.create({
                    ...validCreateProps,
                    categoryId: '',
                }),
            ).toThrow(ArgumentInvalidException);
        });
    });

    it('бросает исключение при пустом warehouseId', () => {
        withRequestContext(() => {
            expect(() =>
                GoodsTurnoverReportLine.create({
                    ...validCreateProps,
                    warehouseId: '',
                }),
            ).toThrow(ArgumentInvalidException);
        });
    });
});

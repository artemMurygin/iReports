import { GoodsFlowMetric } from './goods-flow-metric.value-object';
import { GoodsTurnoverWarehouseTotal } from './goods-turnover-warehouse-total.value-object';
import { GoodsTurnoverReportLine } from '../entities/goods-turnover-report/goods-turnover-report-line.entity';

// add-department-head-salary-rules, tasks.md задача 3.1 (design.md Decision 6a): формула «сумма по
// настоящим корневым строкам + средневзвешенный по остатку коэффициент», перенесённая с frontend
// (`summarizeGoodsTurnoverRows`, pages/GoodsTurnoverReport/model/goodsTurnoverTree.ts) на backend.
// `calculate()` сознательно НЕ фильтрует строки по признаку "корневая категория" сам — вызывающая
// сторона (`GoodsTurnoverReport.totals()`, задача 4) уже передаёт только строки настоящих корневых
// категорий одного склада; здесь только арифметика суммы/средневзвешенного коэффициента.

function lineWithoutRatio(props: {
    categoryId: number;
    outcomeSum?: number;
    stockSum?: number;
    stockQuantity?: number;
}): GoodsTurnoverReportLine {
    return GoodsTurnoverReportLine.create({
        period: '2026-08',
        categoryId: props.categoryId,
        warehouseId: 1,
        outcome: GoodsFlowMetric.create(0, props.outcomeSum ?? 0),
        stock: GoodsFlowMetric.create(
            props.stockQuantity ?? 0,
            props.stockSum ?? 0,
        ),
    });
}

// Строка с уже посчитанным (через calcRatio) turnoverRatio — previousStockSum подбирается так,
// чтобы получить ratio ровно `ratio` при заданном stockSum: calcRatio(prev) =
// outcome.sum / ((prev + stockSum) / 2), поэтому здесь просто задаём outcome/prev напрямую по
// вызывающей стороне через готовые фикстуры ниже, а не выводим их из целевого ratio.
function lineWithRatio(props: {
    categoryId: number;
    outcomeSum: number;
    stockSum: number;
    previousStockSum: number;
}): GoodsTurnoverReportLine {
    const created = GoodsTurnoverReportLine.create({
        period: '2026-08',
        categoryId: props.categoryId,
        warehouseId: 1,
        outcome: GoodsFlowMetric.create(0, props.outcomeSum),
        stock: GoodsFlowMetric.create(0, props.stockSum),
    });
    created.calcRatio(props.previousStockSum);
    return created;
}

describe('GoodsTurnoverWarehouseTotal.calculate', () => {
    it('суммирует outcomeSum/stockSum/stockQuantity по переданным строкам', () => {
        const total = GoodsTurnoverWarehouseTotal.calculate(1, [
            lineWithoutRatio({
                categoryId: 1,
                outcomeSum: 100,
                stockSum: 200,
                stockQuantity: 4,
            }),
            lineWithoutRatio({
                categoryId: 2,
                outcomeSum: 60,
                stockSum: 120,
                stockQuantity: 2,
            }),
        ]);

        expect(total.warehouseId).toBe(1);
        expect(total.outcomeSum).toBe(160);
        expect(total.stockSum).toBe(320);
        expect(total.stockQuantity).toBe(6);
    });

    // Воспроизводит фикстуру фронтенда summarizeGoodsTurnoverRows (goodsTurnoverTree.spec.ts,
    // "weighs the aggregate ratio by stockSum across root rows"): ratio 1 при stockSum 100, ratio 2
    // при stockSum 300 -> (1*100 + 2*300) / 400 = 1.75.
    it('считает средневзвешенный по stockSum коэффициент по строкам с посчитанным turnoverRatio', () => {
        // outcome 100, avg((prev=100)+(curr=100))/2 = 100 -> ratio = 100/100 = 1
        const line1 = lineWithRatio({
            categoryId: 1,
            outcomeSum: 100,
            stockSum: 100,
            previousStockSum: 100,
        });
        // outcome 600, avg((prev=300)+(curr=300))/2 = 300 -> ratio = 600/300 = 2
        const line2 = lineWithRatio({
            categoryId: 2,
            outcomeSum: 600,
            stockSum: 300,
            previousStockSum: 300,
        });

        const total = GoodsTurnoverWarehouseTotal.calculate(1, [line1, line2]);

        expect(total.turnoverRatio).toBeCloseTo(1.75);
    });

    it('turnoverRatio null, если ни одна строка не имеет посчитанного коэффициента', () => {
        const total = GoodsTurnoverWarehouseTotal.calculate(1, [
            lineWithoutRatio({ categoryId: 1, stockSum: 100 }),
        ]);

        expect(total.turnoverRatio).toBeNull();
    });

    it('turnoverRatio null и нулевые суммы для пустого списка строк', () => {
        const total = GoodsTurnoverWarehouseTotal.calculate(1, []);

        expect(total.turnoverRatio).toBeNull();
        expect(total.outcomeSum).toBe(0);
        expect(total.stockSum).toBe(0);
        expect(total.stockQuantity).toBe(0);
    });

    it('игнорирует при взвешивании строки без посчитанного коэффициента', () => {
        // ratio = 200/200 = 1
        const withRatio = lineWithRatio({
            categoryId: 1,
            outcomeSum: 200,
            stockSum: 200,
            previousStockSum: 200,
        });
        // новая категория, нет строки за прошлый период -> calcRatio(null) внутри create не
        // вызывается вовсе -> turnoverRatio остаётся null (не участвует в весе).
        const withoutRatio = lineWithoutRatio({
            categoryId: 2,
            outcomeSum: 900,
            stockSum: 900,
        });

        const total = GoodsTurnoverWarehouseTotal.calculate(1, [
            withRatio,
            withoutRatio,
        ]);

        expect(total.turnoverRatio).toBe(1);
    });
});

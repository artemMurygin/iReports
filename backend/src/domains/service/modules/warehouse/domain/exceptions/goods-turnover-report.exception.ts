import { ConflictException } from '@/shared/exceptions';

// Инвариант агрегата GoodsTurnoverReport: в пределах одного периода (месяца)
// не может быть двух позиций на одну и ту же пару (categoryId, warehouseId)
// — spec.md, "Отчёт строится отдельно по каждому складу" и "Отчёт покрывает
// все категории..." подразумевают ровно одну позицию на пару категория×склад.
// Нарушение сигнализирует об ошибке построения отчёта (BuildGoodsTurnoverReportService,
// задача 9), а не о штатном пользовательском сценарии.
export class DuplicateGoodsTurnoverReportLineException extends ConflictException {
    constructor(period: string, categoryId: number, warehouseId: number) {
        super(
            `Позиция отчёта по оборачиваемости за период ${period} для категории ` +
                `${categoryId} и склада ${warehouseId} уже существует — дублирование ` +
                'пары (категория, склад) в пределах периода недопустимо',
        );
    }
}

// Строка отчёта, чей собственный период не совпадает с периодом агрегата, в
// который она добавляется — защита от сборки отчёта из строк разных месяцев
// (программная ошибка вызывающего кода, а не пользовательский сценарий).
export class GoodsTurnoverReportLinePeriodMismatchException extends ConflictException {
    constructor(reportPeriod: string, linePeriod: string) {
        super(
            `Строка отчёта за период ${linePeriod} не может быть добавлена в ` +
                `отчёт по оборачиваемости за период ${reportPeriod}`,
        );
    }
}

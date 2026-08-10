import { ArgumentInvalidException } from '@/shared/exceptions';

// Фаза 5 реализует SalesPerformance только для направления service (см.
// docs/payroll/plan-payroll-calculation.md, Фаза 5: "хотя в этой фазе
// реализуется только service") — источник ERP-факта для shop появится в
// Фазе 11. direction в плане/шаблоне уже общий для обоих направлений
// (Фазы 3-4), поэтому явный отказ здесь предпочтительнее тихого нулевого
// факта — вызывающая сторона узнаёт, что данных не будет, а не тратит
// время на отладку "почему факт всегда 0".
export class SalesPerformanceDirectionNotSupportedException extends ArgumentInvalidException {
    constructor(direction: string) {
        super(
            `SalesPerformance для направления "${direction}" пока не поддержан — в Фазе 5 реализован только "service"`,
        );
    }
}

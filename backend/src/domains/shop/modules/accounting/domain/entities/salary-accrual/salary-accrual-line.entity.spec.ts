import { ShopSalaryAccrualLine } from './salary-accrual-line.entity';
import {
    ArgumentInvalidException,
    ArgumentNotProvidedException,
} from '@/shared/exceptions';
import { ShopSalaryAccrualLineNotDraftException } from '../../exceptions/salary-accrual.exception';
import { ShopSalaryAccrualLineManualInputNotRequiredException } from '../../exceptions/salary-accrual.exception';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Раздел 18 tasks.md (add-task-based-salary-rule) — зеркало раздела 13
// (domains/service/.../salary-accrual-line.entity.spec.ts) для направления
// shop: первичный ручной ввод суммы+комментария строки типа TaskCompletion
// (design.md Decision 5). Строка создаётся оркестратором расчёта с
// originalAmount/amount = 0 и requiresManualInput = true (spec:
// shop/accounting — то же требование "комментарий обязателен и виден
// сотруднику", что и у service).
describe('ShopSalaryAccrualLine.fromBreakdownLine — requiresManualInput/comment', () => {
    const manualInputSource = {
        ruleId: 'rule-task-1',
        type: 'TaskCompletion',
        name: 'За выполнение задачи',
        targetRole: 'ONLINE_MANAGER',
        amount: 0,
        sources: [{ type: 'taskCompletion', id: 'task-1' }],
        requiresManualInput: true,
    };

    it('копирует requiresManualInput из строки разбивки, comment изначально не задан', () => {
        const line = ShopSalaryAccrualLine.fromBreakdownLine(
            manualInputSource,
            0,
        );

        expect(line.requiresManualInput).toBe(true);
        expect(line.comment).toBeNull();
        expect(line.amount).toBe(0);
        expect(line.originalAmount).toBe(0);
    });

    it('строка без requiresManualInput в источнике — флаг по умолчанию false (прочие типы правил)', () => {
        const line = ShopSalaryAccrualLine.fromBreakdownLine(
            {
                ruleId: 'rule-1',
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ONLINE_MANAGER',
                amount: 2000,
                sources: [],
            },
            0,
        );

        expect(line.requiresManualInput).toBe(false);
        expect(line.comment).toBeNull();
    });
});

describe('ShopSalaryAccrualLine.setManualReward', () => {
    const manualLine = () =>
        ShopSalaryAccrualLine.fromBreakdownLine(
            {
                ruleId: 'rule-task-1',
                type: 'TaskCompletion',
                name: 'За выполнение задачи',
                targetRole: 'ONLINE_MANAGER',
                amount: 0,
                sources: [],
                requiresManualInput: true,
            },
            0,
        );

    it('устанавливает amount/comment и сбрасывает requiresManualInput', () => {
        const line = manualLine();

        line.setManualReward(5000, 'Задача выполнена досрочно');

        expect(line.amount).toBe(5000);
        expect(line.comment).toBe('Задача выполнена досрочно');
        expect(line.requiresManualInput).toBe(false);
        // originalAmount — след исходного расчёта (всегда 0 для
        // TaskCompletion, design.md Decision 5) — не меняется.
        expect(line.originalAmount).toBe(0);
    });

    it('отклоняет пустой комментарий', () => {
        const line = manualLine();

        expect(() =>
            withRequestContext(() => line.setManualReward(5000, '   ')),
        ).toThrow(ArgumentNotProvidedException);
        expect(line.amount).toBe(0);
        expect(line.requiresManualInput).toBe(true);
    });

    it('отклоняет нецелую сумму', () => {
        const line = manualLine();

        expect(() =>
            withRequestContext(() =>
                line.setManualReward(1500.5, 'Комментарий'),
            ),
        ).toThrow(ArgumentInvalidException);
    });

    it('отклоняет строку, для которой requiresManualInput === false (не TaskCompletion)', () => {
        const line = ShopSalaryAccrualLine.fromBreakdownLine(
            {
                ruleId: 'rule-1',
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ONLINE_MANAGER',
                amount: 2000,
                sources: [],
            },
            0,
        );

        expect(() =>
            withRequestContext(() => line.setManualReward(1000, 'Комментарий')),
        ).toThrow(ShopSalaryAccrualLineManualInputNotRequiredException);
    });

    it('отклоняет уже проведённую строку (не DRAFT)', () => {
        const line = manualLine();
        line.markAccrued();

        expect(() =>
            withRequestContext(() => line.setManualReward(1000, 'Комментарий')),
        ).toThrow(ShopSalaryAccrualLineNotDraftException);
    });
});

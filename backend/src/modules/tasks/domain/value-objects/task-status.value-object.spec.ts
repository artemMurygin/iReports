import { TaskStatus } from './task-status.value-object';

// Полный граф переходов задачи (specs/tasks/spec.md, Requirement:
// «Жизненный цикл статуса задачи»):
//   NEW → IN_PROGRESS → DONE → { CLOSED_SUCCESSFULLY, CLOSED_UNSUCCESSFULLY, REWORK }
//   REWORK → IN_PROGRESS
// CLOSED_SUCCESSFULLY/CLOSED_UNSUCCESSFULLY — терминальные, из них
// переходов нет. Любая пара статусов не из этого списка — отклоняется.
describe('TaskStatus', () => {
    // Единственный источник правды о графе для теста ниже — намеренно НЕ
    // переиспользует внутреннюю карту переходов самого TaskStatus (иначе
    // тест проверял бы реализацию саму на себя), а задаёт ожидание
    // независимо, по тексту спеки.
    const ALLOWED_TRANSITIONS: Record<string, string[]> = {
        NEW: ['IN_PROGRESS'],
        IN_PROGRESS: ['DONE'],
        DONE: ['CLOSED_SUCCESSFULLY', 'CLOSED_UNSUCCESSFULLY', 'REWORK'],
        REWORK: ['IN_PROGRESS'],
        CLOSED_SUCCESSFULLY: [],
        CLOSED_UNSUCCESSFULLY: [],
    };
    const ALL_CODES = Object.keys(ALLOWED_TRANSITIONS);

    describe('canTransitionTo — исчерпывающая проверка графа (6×6 комбинаций)', () => {
        for (const from of ALL_CODES) {
            for (const to of ALL_CODES) {
                const expected = ALLOWED_TRANSITIONS[from].includes(to);
                it(`${from} → ${to}: ${expected ? 'разрешён' : 'отклонён'}`, () => {
                    const status = TaskStatus.fromCode(from);
                    const next = TaskStatus.fromCode(to);
                    expect(status.canTransitionTo(next)).toBe(expected);
                });
            }
        }
    });

    describe('isTerminal', () => {
        it('CLOSED_SUCCESSFULLY — терминальный', () => {
            expect(
                TaskStatus.fromCode('CLOSED_SUCCESSFULLY').isTerminal(),
            ).toBe(true);
        });

        it('CLOSED_UNSUCCESSFULLY — терминальный', () => {
            expect(
                TaskStatus.fromCode('CLOSED_UNSUCCESSFULLY').isTerminal(),
            ).toBe(true);
        });

        it.each(['NEW', 'IN_PROGRESS', 'DONE', 'REWORK'])(
            '%s — не терминальный',
            (code) => {
                expect(TaskStatus.fromCode(code).isTerminal()).toBe(false);
            },
        );
    });

    describe('именованные фабрики', () => {
        it('TaskStatus.new() эквивалентен fromCode("NEW")', () => {
            expect(TaskStatus.new().code).toBe('NEW');
        });
    });

    it('fromCode отклоняет пустой/неизвестный код', () => {
        expect(() => TaskStatus.fromCode('')).toThrow();
        expect(() => TaskStatus.fromCode('UNKNOWN')).toThrow();
    });
});

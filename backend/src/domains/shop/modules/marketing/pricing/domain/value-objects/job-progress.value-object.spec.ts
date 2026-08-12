import { JobProgress } from './job-progress.value-object';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

describe('JobProgress', () => {
    it('создаёт валидный прогресс', () => {
        const progress = JobProgress.create({
            stage: 'loadCatalog',
            processed: 2,
            total: 5,
            message: 'МС [iPhone]: 120 товаров',
        });

        expect(progress.getStage()).toBe('loadCatalog');
        expect(progress.getProcessed()).toBe(2);
        expect(progress.getTotal()).toBe(5);
        expect(progress.getMessage()).toBe('МС [iPhone]: 120 товаров');
        expect(progress.getPercent()).toBe(0.4);
    });

    it('processed может быть равен total (этап завершён)', () => {
        const progress = JobProgress.create({
            stage: 'done',
            processed: 5,
            total: 5,
            message: 'Готово',
        });

        expect(progress.getPercent()).toBe(1);
    });

    it('total = 0 (счётчик ещё неизвестен) — процент не определён', () => {
        const progress = JobProgress.create({
            stage: 'parseXlsx',
            processed: 0,
            total: 0,
            message: 'Парсинг прайса...',
        });

        expect(progress.getPercent()).toBeNull();
    });

    it('отклоняет пустой stage', () => {
        withRequestContext(() => {
            expect(() =>
                JobProgress.create({
                    stage: '   ',
                    processed: 0,
                    total: 0,
                    message: 'msg',
                }),
            ).toThrow(ArgumentInvalidException);
        });
    });

    it('отклоняет пустой message', () => {
        withRequestContext(() => {
            expect(() =>
                JobProgress.create({
                    stage: 'stage',
                    processed: 0,
                    total: 0,
                    message: '',
                }),
            ).toThrow(ArgumentInvalidException);
        });
    });

    it.each([-1, 1.5])(
        'отклоняет processed, не являющийся неотрицательным целым: %s',
        (processed) => {
            withRequestContext(() => {
                expect(() =>
                    JobProgress.create({
                        stage: 'stage',
                        processed,
                        total: 5,
                        message: 'msg',
                    }),
                ).toThrow(ArgumentInvalidException);
            });
        },
    );

    it.each([-1, 2.5])(
        'отклоняет total, не являющийся неотрицательным целым: %s',
        (total) => {
            withRequestContext(() => {
                expect(() =>
                    JobProgress.create({
                        stage: 'stage',
                        processed: 0,
                        total,
                        message: 'msg',
                    }),
                ).toThrow(ArgumentInvalidException);
            });
        },
    );

    it('отклоняет processed > total', () => {
        withRequestContext(() => {
            expect(() =>
                JobProgress.create({
                    stage: 'stage',
                    processed: 6,
                    total: 5,
                    message: 'msg',
                }),
            ).toThrow(ArgumentInvalidException);
        });
    });
});

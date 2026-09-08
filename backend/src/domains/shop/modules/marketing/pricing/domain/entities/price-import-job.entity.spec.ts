import { PriceImportJob } from './price-import-job.entity';
import {
    PriceImportJobAlreadyStartedException,
    PriceImportJobNotRunningException,
} from '../exceptions/price-import-job.exception';
import { PriceImportJobCompletedDomainEvent } from '../events/price-import-job-completed.domain-event';
import { PriceImportJobFailedDomainEvent } from '../events/price-import-job-failed.domain-event';
import { JobProgress } from '../value-objects/job-progress.value-object';
import { ProductMatch } from '../value-objects/product-match.value-object';
import { CostChange } from '../value-objects/cost-change.value-object';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

function aMatch(): ProductMatch {
    return ProductMatch.create({
        sourceRowName: 'Apple iPhone 16 Pro 256GB',
        sourcePrice: 99990,
        matchedProductId: 'ms-1',
        matchedProductName: 'Apple iPhone 16 Pro 256GB Black Titanium',
        method: 'llm',
        confidence: 0.9,
    });
}

function aCostChange(): CostChange {
    return CostChange.create({
        productId: 'ms-1',
        productName: 'Apple iPhone 16 Pro 256GB Black Titanium',
        oldCost: 80000,
        newCost: 82000,
    });
}

function aProgress(): JobProgress {
    return JobProgress.create({
        stage: 'matchCategories',
        processed: 1,
        total: 5,
        message: 'Сопоставление [iPhone]...',
    });
}

describe('PriceImportJob', () => {
    it('создаётся в статусе CREATED', () => {
        const job = PriceImportJob.create();

        expect(job.status).toBe('CREATED');
        expect(job.isCreated()).toBe(true);
        expect(job.progress).toBeNull();
        expect(job.result).toBeNull();
        expect(job.errorMessage).toBeNull();
        expect(job.startedAt).toBeNull();
        expect(job.finishedAt).toBeNull();
    });

    describe('start()', () => {
        it('переводит CREATED -> RUNNING и фиксирует startedAt', () => {
            const job = PriceImportJob.create();

            job.start();

            expect(job.status).toBe('RUNNING');
            expect(job.isRunning()).toBe(true);
            expect(job.startedAt).toBeInstanceOf(Date);
        });

        it('повторный start() уже запущенной джобы отклоняется', () => {
            withRequestContext(() => {
                const job = PriceImportJob.create();
                job.start();

                expect(() => job.start()).toThrow(
                    PriceImportJobAlreadyStartedException,
                );
            });
        });

        it('start() завершённой (COMPLETED) джобы — перезапуск запрещён', () => {
            withRequestContext(() => {
                const job = PriceImportJob.create();
                job.start();
                job.complete({ matches: [], costChanges: [] });

                expect(() => job.start()).toThrow(
                    PriceImportJobAlreadyStartedException,
                );
            });
        });

        it('start() упавшей (FAILED) джобы — перезапуск запрещён', () => {
            withRequestContext(() => {
                const job = PriceImportJob.create();
                job.start();
                job.fail('boom');

                expect(() => job.start()).toThrow(
                    PriceImportJobAlreadyStartedException,
                );
            });
        });
    });

    describe('updateProgress()', () => {
        it('обновляет прогресс у выполняющейся джобы', () => {
            const job = PriceImportJob.create();
            job.start();

            const progress = aProgress();
            job.updateProgress(progress);

            expect(job.progress).toBe(progress);
        });

        it('обновление прогресса незапущенной (CREATED) джобы отклоняется', () => {
            withRequestContext(() => {
                const job = PriceImportJob.create();

                expect(() => job.updateProgress(aProgress())).toThrow(
                    PriceImportJobNotRunningException,
                );
            });
        });

        it('обновление прогресса завершённой джобы отклоняется', () => {
            withRequestContext(() => {
                const job = PriceImportJob.create();
                job.start();
                job.complete({ matches: [], costChanges: [] });

                expect(() => job.updateProgress(aProgress())).toThrow(
                    PriceImportJobNotRunningException,
                );
            });
        });
    });

    describe('complete()', () => {
        it('переводит RUNNING -> COMPLETED, сохраняет результат и порождает PriceImportJobCompletedDomainEvent', () => {
            withRequestContext(() => {
                const job = PriceImportJob.create();
                job.start();

                const match = aMatch();
                const costChange = aCostChange();
                job.complete({ matches: [match], costChanges: [costChange] });

                expect(job.status).toBe('COMPLETED');
                expect(job.isCompleted()).toBe(true);
                expect(job.finishedAt).toBeInstanceOf(Date);
                expect(job.result).toEqual({
                    matches: [match],
                    costChanges: [costChange],
                });
                expect(job.domainEvents).toHaveLength(1);
                const [event] = job.domainEvents as [
                    PriceImportJobCompletedDomainEvent,
                ];
                expect(event).toBeInstanceOf(
                    PriceImportJobCompletedDomainEvent,
                );
                expect(event.matchedCount).toBe(1);
                expect(event.updatedCount).toBe(1);
            });
        });

        it('нельзя завершить незапущенную (CREATED) джобу', () => {
            withRequestContext(() => {
                const job = PriceImportJob.create();

                expect(() =>
                    job.complete({ matches: [], costChanges: [] }),
                ).toThrow(PriceImportJobNotRunningException);
            });
        });

        it('повторный complete() уже завершённой джобы отклоняется', () => {
            withRequestContext(() => {
                const job = PriceImportJob.create();
                job.start();
                job.complete({ matches: [], costChanges: [] });

                expect(() =>
                    job.complete({ matches: [], costChanges: [] }),
                ).toThrow(PriceImportJobNotRunningException);
            });
        });

        it('complete() упавшей (FAILED) джобы отклоняется', () => {
            withRequestContext(() => {
                const job = PriceImportJob.create();
                job.start();
                job.fail('boom');

                expect(() =>
                    job.complete({ matches: [], costChanges: [] }),
                ).toThrow(PriceImportJobNotRunningException);
            });
        });
    });

    describe('fail()', () => {
        it('переводит RUNNING -> FAILED, сохраняет сообщение об ошибке и порождает PriceImportJobFailedDomainEvent', () => {
            withRequestContext(() => {
                const job = PriceImportJob.create();
                job.start();

                job.fail('Не удалось распарсить XLSX');

                expect(job.status).toBe('FAILED');
                expect(job.isFailed()).toBe(true);
                expect(job.finishedAt).toBeInstanceOf(Date);
                expect(job.errorMessage).toBe('Не удалось распарсить XLSX');
                expect(job.domainEvents).toHaveLength(1);
                const [event] = job.domainEvents as [
                    PriceImportJobFailedDomainEvent,
                ];
                expect(event).toBeInstanceOf(PriceImportJobFailedDomainEvent);
                expect(event.errorMessage).toBe('Не удалось распарсить XLSX');
            });
        });

        // "fail() на CREATED-джобе, которую никогда не запускали" — отдельный явный кейс из
        // задания фазы, хотя семантически покрывается тем же инвариантом, что и complete().
        it('нельзя провалить незапущенную (CREATED) джобу', () => {
            withRequestContext(() => {
                const job = PriceImportJob.create();

                expect(() => job.fail('boom')).toThrow(
                    PriceImportJobNotRunningException,
                );
            });
        });

        it('повторный fail() уже упавшей джобы отклоняется', () => {
            withRequestContext(() => {
                const job = PriceImportJob.create();
                job.start();
                job.fail('first');

                expect(() => job.fail('second')).toThrow(
                    PriceImportJobNotRunningException,
                );
            });
        });

        it('fail() уже завершённой (COMPLETED) джобы отклоняется', () => {
            withRequestContext(() => {
                const job = PriceImportJob.create();
                job.start();
                job.complete({ matches: [], costChanges: [] });

                expect(() => job.fail('boom')).toThrow(
                    PriceImportJobNotRunningException,
                );
            });
        });

        it('отклоняет пустое errorMessage', () => {
            withRequestContext(() => {
                const job = PriceImportJob.create();
                job.start();

                expect(() => job.fail('   ')).toThrow(ArgumentInvalidException);
            });
        });
    });
});

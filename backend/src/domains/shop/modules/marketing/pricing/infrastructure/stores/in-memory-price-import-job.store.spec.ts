import { firstValueFrom, map, toArray } from 'rxjs';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { InMemoryPriceImportJobStore } from './in-memory-price-import-job.store';
import { PriceImportJob } from '../../domain/entities/price-import-job.entity';

describe('InMemoryPriceImportJobStore', () => {
    it('save() делает джобу доступной через findById()', () => {
        const store = new InMemoryPriceImportJobStore();
        const job = PriceImportJob.create();

        store.save(job);

        expect(store.findById(job.id)).toBe(job);
    });

    it('findById() для неизвестного id возвращает undefined', () => {
        const store = new InMemoryPriceImportJobStore();
        expect(store.findById('unknown')).toBeUndefined();
    });

    it('subscribe() эмитит каждый save() и завершается, когда джоба переходит в терминальный статус', async () => {
        await withRequestContext(async () => {
            const store = new InMemoryPriceImportJobStore();
            const job = PriceImportJob.create();
            store.save(job);

            // `job` — один и тот же мутируемый объект на все save(): читаем `status` синхронно на
            // каждую эмиссию (map до toArray), а не после — иначе к моменту чтения буфера все
            // элементы уже указывали бы на финальное состояние одного и того же объекта (тот же
            // приём нужен и реальному подписчику: сериализовать снапшот в обработчике `next`, не
            // откладывая).
            const emittedStatuses$ = firstValueFrom(
                store.subscribe(job.id)!.pipe(
                    map((snapshot) => snapshot.status),
                    toArray(),
                ),
            );

            job.start();
            store.save(job);
            job.complete({ matches: [], costChanges: [] });
            store.save(job);

            expect(await emittedStatuses$).toEqual(['RUNNING', 'COMPLETED']);
        });
    });

    it('subscribe() для неизвестного id возвращает undefined', () => {
        const store = new InMemoryPriceImportJobStore();
        expect(store.subscribe('unknown')).toBeUndefined();
    });

    it('delete() убирает джобу из findById()', () => {
        const store = new InMemoryPriceImportJobStore();
        const job = PriceImportJob.create();
        store.save(job);

        store.delete(job.id);

        expect(store.findById(job.id)).toBeUndefined();
    });
});

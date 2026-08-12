import { MessageEvent } from '@nestjs/common';
import { Subject } from 'rxjs';
import type { PriceImportJobStatusResponse } from 'ireports-contracts';
import { SubscribePriceImportJobProgressHttpController } from './subscribe-price-import-job-progress.http.controller';
import type { SubscribePriceImportJobProgressService } from '../../application/services/subscribe-price-import-job-progress.service';
import { PriceImportJobNotFoundException } from '../../domain/exceptions/price-import-job.exception';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Проверяет ровно то, что PRD (раздел "инварианты", п. "SSE-эндпоинт с
// heartbeat каждые 20 с") требует сохранить из легаси
// PriceMonitoringController.getProgress — без реального ожидания 20
// секунд (jest fake timers продвигают виртуальное время): heartbeat идёт
// каждые 20с ровно, пока источник не завершится, и останавливается сразу
// после (takeUntil(done$), см. комментарий в самом контроллере).
describe('SubscribePriceImportJobProgressHttpController (heartbeat)', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    function buildStatus(
        status: PriceImportJobStatusResponse['status'],
    ): PriceImportJobStatusResponse {
        return {
            id: 'job-1',
            status,
            progress: null,
            errorMessage: null,
        };
    }

    it('404 сразу (до подписки), если джобы с таким id нет — сервис бросает синхронно', () => {
        withRequestContext(() => {
            const fakeService: SubscribePriceImportJobProgressService = {
                execute: jest.fn(() => {
                    throw new PriceImportJobNotFoundException('unknown');
                }),
            } as unknown as SubscribePriceImportJobProgressService;
            const controller =
                new SubscribePriceImportJobProgressHttpController(fakeService);

            expect(() => controller.progress('unknown')).toThrow(
                PriceImportJobNotFoundException,
            );
        });
    });

    it('эмитит heartbeat каждые 20 секунд, пока источник не завершится, и не эмитит его после завершения', () => {
        const source$ = new Subject<PriceImportJobStatusResponse>();
        const fakeService: SubscribePriceImportJobProgressService = {
            execute: jest.fn(() => source$.asObservable()),
        } as unknown as SubscribePriceImportJobProgressService;
        const controller = new SubscribePriceImportJobProgressHttpController(
            fakeService,
        );

        const received: MessageEvent[] = [];
        const subscription = controller
            .progress('job-1')
            .subscribe((event) => received.push(event));

        // < 20с — heartbeat ещё не должен сработать.
        jest.advanceTimersByTime(19_999);
        expect(
            received.filter(
                (e) => (e.data as { type?: string }).type === 'heartbeat',
            ),
        ).toHaveLength(0);

        // Ровно 20с — первый heartbeat.
        jest.advanceTimersByTime(1);
        expect(
            received.filter(
                (e) => (e.data as { type?: string }).type === 'heartbeat',
            ),
        ).toHaveLength(1);

        // Ещё 20с — второй heartbeat (интервал, не однократный таймаут).
        jest.advanceTimersByTime(20_000);
        expect(
            received.filter(
                (e) => (e.data as { type?: string }).type === 'heartbeat',
            ),
        ).toHaveLength(2);

        // Реальный прогресс джобы форвардится как есть, наравне с heartbeat.
        source$.next(buildStatus('RUNNING'));
        expect(received[received.length - 1].data).toEqual(
            buildStatus('RUNNING'),
        );

        // Источник завершается (терминальный статус) -> heartbeat должен
        // остановиться (takeUntil(done$) из finalize источника).
        source$.next(buildStatus('COMPLETED'));
        source$.complete();

        const heartbeatsBeforeCompletion = received.filter(
            (e) => (e.data as { type?: string }).type === 'heartbeat',
        ).length;
        jest.advanceTimersByTime(60_000);
        expect(
            received.filter(
                (e) => (e.data as { type?: string }).type === 'heartbeat',
            ),
        ).toHaveLength(heartbeatsBeforeCompletion);

        subscription.unsubscribe();
    });
});

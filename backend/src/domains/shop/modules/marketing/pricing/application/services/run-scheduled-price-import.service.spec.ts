import type { CommandBus } from '@nestjs/cqrs';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { RunScheduledPriceImportService } from './run-scheduled-price-import.service';
import { StartPriceImportCommand } from '../command/start-price-import.command';
import { PriceListFile } from '../../domain/value-objects/price-list-file.value-object';
import {
    PriceListFileAmbiguousException,
    PriceListFileNotFoundException,
} from '../../domain/exceptions/scheduled-price-import.exception';
import type { PriceImportJob } from '../../domain/entities/price-import-job.entity';
import type { PriceImportJobStore } from '../ports/price-import-job-store.port';
import type { PriceImportNotifier } from '../ports/price-import-notifier.port';
import type { PriceListSource } from '../ports/price-list-source.port';
import type { PriceListVersionStore } from '../ports/price-list-version-store.port';
import type { LastScheduledImportStore } from '../ports/last-scheduled-import-store.port';
import type { MoySkladPriceUpdateTrigger } from '../ports/moysklad-price-update-trigger.port';

const FILE_NAME = 'Прайс 06.10.xlsx';
const FILE_CONTENT = Buffer.from('xlsx-bytes');

function buildFile(name = FILE_NAME): PriceListFile {
    return PriceListFile.create({
        id: 'file-1',
        name,
        mimeType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
}

type JobStatus = 'COMPLETED' | 'FAILED' | 'CANCELLED';

// Джоба-заглушка: сервису важен только статус (PriceImportJob собирается через пайплайн импорта).
function fakeJob(status: JobStatus): PriceImportJob {
    return { status } as unknown as PriceImportJob;
}

interface Fakes {
    source: jest.Mocked<PriceListSource>;
    versionStore: jest.Mocked<PriceListVersionStore>;
    notifier: jest.Mocked<PriceImportNotifier>;
    trigger: jest.Mocked<MoySkladPriceUpdateTrigger>;
    lastRunStore: jest.Mocked<LastScheduledImportStore>;
    jobStore: { findActive: jest.Mock; findById: jest.Mock };
    commandBus: { execute: jest.Mock };
    service: RunScheduledPriceImportService;
}

function build(opts: { lastName?: string | null; jobStatus?: JobStatus | null } = {}): Fakes {
    const source: jest.Mocked<PriceListSource> = {
        findPriceListFile: jest.fn().mockResolvedValue(buildFile()),
        download: jest.fn().mockResolvedValue(FILE_CONTENT),
    };
    const versionStore: jest.Mocked<PriceListVersionStore> = {
        getLastUploadedName: jest.fn().mockResolvedValue(opts.lastName ?? null),
        saveUploadedName: jest.fn().mockResolvedValue(undefined),
    };
    const notifier: jest.Mocked<PriceImportNotifier> = {
        notifyUploaded: jest.fn().mockResolvedValue(undefined),
        notifyUnchanged: jest.fn().mockResolvedValue(undefined),
        notifyFailed: jest.fn().mockResolvedValue(undefined),
        notifyPriceUpdateFailed: jest.fn().mockResolvedValue(undefined),
    };
    const trigger: jest.Mocked<MoySkladPriceUpdateTrigger> = {
        triggerPriceUpdate: jest.fn().mockResolvedValue(undefined),
    };
    const lastRunStore: jest.Mocked<LastScheduledImportStore> = {
        save: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue(null),
    };
    const jobStatus = opts.jobStatus === undefined ? 'COMPLETED' : opts.jobStatus;
    const jobStore = {
        findActive: jest.fn().mockReturnValue(undefined),
        findById: jest
            .fn()
            .mockReturnValue(jobStatus ? fakeJob(jobStatus) : undefined),
    };
    const commandBus = { execute: jest.fn().mockResolvedValue(undefined) };
    const service = new RunScheduledPriceImportService(
        source,
        versionStore,
        notifier,
        jobStore as unknown as PriceImportJobStore,
        commandBus as unknown as CommandBus,
        trigger,
        lastRunStore,
    );
    return { source, versionStore, notifier, trigger, lastRunStore, jobStore, commandBus, service };
}

describe('RunScheduledPriceImportService', () => {
    // spec: shop/price-import-schedule#выгрузка-только-при-изменении-прайса
    it('прайс обновился: запускает импорт, сохраняет название и уведомляет об успехе', async () => {
        const f = build({ lastName: 'Старый прайс.xlsx' });

        const outcome = await withRequestContext(() => f.service.run());

        expect(outcome.getKind()).toBe('uploaded');
        expect(f.commandBus.execute).toHaveBeenCalledTimes(1);
        const command = f.commandBus.execute.mock
            .calls[0][0] as StartPriceImportCommand;
        expect(command).toBeInstanceOf(StartPriceImportCommand);
        expect(command.fileBase64).toBe(FILE_CONTENT.toString('base64'));
        expect(f.jobStore.findById).toHaveBeenCalledWith(command.id);
        expect(f.versionStore.saveUploadedName).toHaveBeenCalledWith(FILE_NAME);
        expect(f.notifier.notifyUploaded).toHaveBeenCalledTimes(1);
        expect(f.notifier.notifyFailed).not.toHaveBeenCalled();
    });

    it('первая выгрузка (название ещё не запоминалось): импорт запускается', async () => {
        const f = build({ lastName: null });

        const outcome = await withRequestContext(() => f.service.run());

        expect(outcome.getKind()).toBe('uploaded');
        expect(f.commandBus.execute).toHaveBeenCalledTimes(1);
    });

    it('название сохраняется до уведомления', async () => {
        const f = build();
        const order: string[] = [];
        f.versionStore.saveUploadedName.mockImplementation(async () => {
            order.push('save');
        });
        f.notifier.notifyUploaded.mockImplementation(async () => {
            order.push('notify');
        });

        await withRequestContext(() => f.service.run());

        expect(order).toEqual(['save', 'notify']);
    });

    it('прайс не изменился: notifyUnchanged, импорт не запускается', async () => {
        const f = build({ lastName: FILE_NAME });

        const outcome = await withRequestContext(() => f.service.run());

        expect(outcome.getKind()).toBe('unchanged');
        expect(f.notifier.notifyUnchanged).toHaveBeenCalledTimes(1);
        expect(f.source.download).not.toHaveBeenCalled();
        expect(f.commandBus.execute).not.toHaveBeenCalled();
        expect(f.versionStore.saveUploadedName).not.toHaveBeenCalled();
    });

    // spec: shop/price-import-schedule#источник-прайс-листа
    it('папка пуста: failed + notifyFailed, импорт не запускается', async () => {
        const f = build();
        f.source.findPriceListFile.mockRejectedValue(
            withRequestContext(() => new PriceListFileNotFoundException()),
        );

        const outcome = await withRequestContext(() => f.service.run());

        expect(outcome.getKind()).toBe('failed');
        expect(outcome.getReason()).toEqual(expect.any(String));
        expect(f.notifier.notifyFailed).toHaveBeenCalledTimes(1);
        expect(f.commandBus.execute).not.toHaveBeenCalled();
        expect(f.versionStore.saveUploadedName).not.toHaveBeenCalled();
    });

    it('в папке несколько файлов: failed + notifyFailed', async () => {
        const f = build();
        f.source.findPriceListFile.mockRejectedValue(
            withRequestContext(() => new PriceListFileAmbiguousException(2)),
        );

        const outcome = await withRequestContext(() => f.service.run());

        expect(outcome.getKind()).toBe('failed');
        expect(f.notifier.notifyFailed).toHaveBeenCalledTimes(1);
        expect(f.commandBus.execute).not.toHaveBeenCalled();
    });

    // spec: shop/price-import-schedule#уведомление-об-ошибке
    it('ошибка Drive при получении списка файлов: failed + notifyFailed', async () => {
        const f = build();
        f.source.findPriceListFile.mockRejectedValue(new Error('403 Drive'));

        const outcome = await withRequestContext(() => f.service.run());

        expect(outcome.getKind()).toBe('failed');
        expect(f.notifier.notifyFailed).toHaveBeenCalledTimes(1);
        expect(f.commandBus.execute).not.toHaveBeenCalled();
    });

    it('ошибка скачивания файла: failed + notifyFailed, название не сохраняется', async () => {
        const f = build();
        f.source.download.mockRejectedValue(new Error('download failed'));

        const outcome = await withRequestContext(() => f.service.run());

        expect(outcome.getKind()).toBe('failed');
        expect(f.notifier.notifyFailed).toHaveBeenCalledTimes(1);
        expect(f.commandBus.execute).not.toHaveBeenCalled();
        expect(f.versionStore.saveUploadedName).not.toHaveBeenCalled();
    });

    it('джоба FAILED: failed + notifyFailed, название не сохраняется', async () => {
        const f = build({ jobStatus: 'FAILED' });

        const outcome = await withRequestContext(() => f.service.run());

        expect(outcome.getKind()).toBe('failed');
        expect(f.notifier.notifyFailed).toHaveBeenCalledTimes(1);
        expect(f.notifier.notifyUploaded).not.toHaveBeenCalled();
        expect(f.versionStore.saveUploadedName).not.toHaveBeenCalled();
    });

    it('джоба CANCELLED: failed + notifyFailed, название не сохраняется', async () => {
        const f = build({ jobStatus: 'CANCELLED' });

        const outcome = await withRequestContext(() => f.service.run());

        expect(outcome.getKind()).toBe('failed');
        expect(f.notifier.notifyFailed).toHaveBeenCalledTimes(1);
        expect(f.versionStore.saveUploadedName).not.toHaveBeenCalled();
    });

    it('джобы нет в хранилище после выполнения: failed', async () => {
        const f = build({ jobStatus: null });

        const outcome = await withRequestContext(() => f.service.run());

        expect(outcome.getKind()).toBe('failed');
        expect(f.notifier.notifyFailed).toHaveBeenCalledTimes(1);
        expect(f.versionStore.saveUploadedName).not.toHaveBeenCalled();
    });

    it('команда импорта бросила: failed + notifyFailed', async () => {
        const f = build();
        f.commandBus.execute.mockRejectedValue(new Error('boom'));

        const outcome = await withRequestContext(() => f.service.run());

        expect(outcome.getKind()).toBe('failed');
        expect(f.notifier.notifyFailed).toHaveBeenCalledTimes(1);
        expect(f.versionStore.saveUploadedName).not.toHaveBeenCalled();
    });

    // spec: shop/price-import-schedule#не-более-одной-выгрузки-одновременно
    it('активная джоба: импорт не запускается, failed + notifyFailed', async () => {
        const f = build();
        f.jobStore.findActive.mockReturnValue(fakeJob('COMPLETED'));

        const outcome = await withRequestContext(() => f.service.run());

        expect(outcome.getKind()).toBe('failed');
        expect(f.notifier.notifyFailed).toHaveBeenCalledTimes(1);
        expect(f.source.findPriceListFile).not.toHaveBeenCalled();
        expect(f.commandBus.execute).not.toHaveBeenCalled();
        expect(f.versionStore.saveUploadedName).not.toHaveBeenCalled();
    });

    // spec: shop/price-import-schedule#отказоустойчивость-уведомлений
    it('notifier бросил после успеха: название сохранено, outcome uploaded, run не бросает', async () => {
        const f = build();
        f.notifier.notifyUploaded.mockRejectedValue(new Error('telegram down'));

        const outcome = await withRequestContext(() => f.service.run());

        expect(outcome.getKind()).toBe('uploaded');
        expect(f.versionStore.saveUploadedName).toHaveBeenCalledWith(FILE_NAME);
        expect(f.commandBus.execute).toHaveBeenCalledTimes(1);
    });

    it('notifier бросил при ошибке: run не бросает, outcome failed', async () => {
        const f = build();
        f.source.findPriceListFile.mockRejectedValue(new Error('drive'));
        f.notifier.notifyFailed.mockRejectedValue(new Error('telegram down'));

        const outcome = await withRequestContext(() => f.service.run());

        expect(outcome.getKind()).toBe('failed');
    });

    it('notifier бросил при unchanged: outcome unchanged', async () => {
        const f = build({ lastName: FILE_NAME });
        f.notifier.notifyUnchanged.mockRejectedValue(new Error('telegram down'));

        const outcome = await withRequestContext(() => f.service.run());

        expect(outcome.getKind()).toBe('unchanged');
    });

    it('сбой сохранения названия: failed, а не uploaded', async () => {
        const f = build();
        f.versionStore.saveUploadedName.mockRejectedValue(new Error('redis'));

        const outcome = await withRequestContext(() => f.service.run());

        expect(outcome.getKind()).toBe('failed');
        expect(f.notifier.notifyUploaded).not.toHaveBeenCalled();
        expect(f.notifier.notifyFailed).toHaveBeenCalledTimes(1);
    });

    // spec: shop/price-import-schedule#выгрузка-только-при-изменении-прайса (повтор после ошибки)
    it('после ошибки название не сохранено — следующий запуск выгружает тот же файл', async () => {
        const f = build({ jobStatus: 'FAILED' });
        let stored: string | null = null;
        f.versionStore.getLastUploadedName.mockImplementation(async () => stored);
        f.versionStore.saveUploadedName.mockImplementation(async (n) => {
            stored = n;
        });

        const first = await withRequestContext(() => f.service.run());
        expect(first.getKind()).toBe('failed');
        expect(stored).toBeNull();

        f.jobStore.findById.mockReturnValue(fakeJob('COMPLETED'));
        const second = await withRequestContext(() => f.service.run());

        expect(second.getKind()).toBe('uploaded');
        expect(f.commandBus.execute).toHaveBeenCalledTimes(2);
        expect(stored).toBe(FILE_NAME);
    });

    // spec: shop/price-import-schedule#обновление-цен-в-моём-складе-через-n8n
    it('после успешной выгрузки в таблицу запускает обновление цен в МойСклад, затем уведомляет об успехе', async () => {
        const f = build();
        const order: string[] = [];
        f.trigger.triggerPriceUpdate.mockImplementation(async () => {
            order.push('trigger');
        });
        f.notifier.notifyUploaded.mockImplementation(async () => {
            order.push('notify');
        });

        const outcome = await withRequestContext(() => f.service.run());

        expect(outcome.getKind()).toBe('uploaded');
        expect(order).toEqual(['trigger', 'notify']);
        expect(f.notifier.notifyPriceUpdateFailed).not.toHaveBeenCalled();
    });

    it('не запускает обновление цен, если прайс не изменился или импорт упал', async () => {
        const unchanged = build({ lastName: FILE_NAME });
        await withRequestContext(() => unchanged.service.run());
        expect(unchanged.trigger.triggerPriceUpdate).not.toHaveBeenCalled();

        const failed = build({ jobStatus: 'FAILED' });
        await withRequestContext(() => failed.service.run());
        expect(failed.trigger.triggerPriceUpdate).not.toHaveBeenCalled();
    });

    it('сбой n8n: выгрузка считается выполненной (название сохранено), уходит отдельное уведомление вместо «выгружено»', async () => {
        const f = build();
        f.trigger.triggerPriceUpdate.mockRejectedValue(new Error('n8n'));

        const outcome = await withRequestContext(() => f.service.run());

        expect(outcome.getKind()).toBe('uploaded');
        expect(f.versionStore.saveUploadedName).toHaveBeenCalledWith(FILE_NAME);
        expect(f.notifier.notifyPriceUpdateFailed).toHaveBeenCalledTimes(1);
        expect(f.notifier.notifyUploaded).not.toHaveBeenCalled();
        expect(f.notifier.notifyFailed).not.toHaveBeenCalled();
    });

    // spec: shop/price-import-schedule#время-последней-автоматической-выгрузки
    it('успешная выгрузка запоминает время завершения со статусом success', async () => {
        const f = build();

        await withRequestContext(() => f.service.run());

        expect(f.lastRunStore.save).toHaveBeenCalledTimes(1);
        const run = f.lastRunStore.save.mock.calls[0][0];
        expect(run.status).toBe('success');
        expect(Math.abs(run.finishedAt - Date.now())).toBeLessThan(5000);
    });

    it('сбой n8n не меняет статус: выгрузка прайса всё равно success', async () => {
        const f = build();
        f.trigger.triggerPriceUpdate.mockRejectedValue(new Error('n8n'));

        await withRequestContext(() => f.service.run());

        expect(f.lastRunStore.save.mock.calls[0][0].status).toBe('success');
    });

    it('неудачная выгрузка запоминается со статусом error', async () => {
        const f = build({ jobStatus: 'FAILED' });

        await withRequestContext(() => f.service.run());

        expect(f.lastRunStore.save.mock.calls[0][0].status).toBe('error');
    });

    it('прайс не изменился: время последней выгрузки не трогается', async () => {
        const f = build({ lastName: FILE_NAME });

        await withRequestContext(() => f.service.run());

        expect(f.lastRunStore.save).not.toHaveBeenCalled();
    });

    it('сбой записи времени не ломает итог выгрузки', async () => {
        const f = build();
        f.lastRunStore.save.mockRejectedValue(new Error('redis'));

        const outcome = await withRequestContext(() => f.service.run());

        expect(outcome.getKind()).toBe('uploaded');
        expect(f.notifier.notifyUploaded).toHaveBeenCalledTimes(1);
    });
});

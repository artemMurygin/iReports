import type { Observable } from 'rxjs';
import type { PriceImportJob } from '../../domain/entities/price-import-job.entity';

// Порт хранения/публикации состояния джобы импорта цен (Фаза 9, см. PRD раздел 3а: "состояние
// джобы + подписка на прогресс") — единственная точка доступа к состоянию `PriceImportJob` между
// HTTP-запросами (создание → поллинг статуса → SSE), см. критерий готовности плана "состояние
// джобы доступно только через порт PRICE_IMPORT_JOB_STORE; прямых обращений к Map/Subject из
// application-слоя нет". Первая (и на эту итерацию единственная) реализация — in-memory, порт
// экранов легаси `PriceMonitoringProgressService`
// (src/TODO/priceMonitoring/priceMonitoring.progress.service.ts), не БД: см. PRD "не в скоупе" —
// персистентная джоба не заводится.
export interface PriceImportJobStore {
    /** Сохраняет текущий снапшот джобы (создание и каждый переход состояния/прогресса). */
    save(job: PriceImportJob): void;

    findById(id: string): PriceImportJob | undefined;

    /**
     * Поток снапшотов джобы — на каждый `save(job)` эмитится текущее состояние. Источник для
     * будущего SSE-эндпоинта (Фаза 10); завершается сам, когда джоба переходит в терминальный
     * статус (COMPLETED/FAILED) — подписчику не нужно определять завершение отдельно.
     */
    subscribe(id: string): Observable<PriceImportJob> | undefined;

    /** Удаляет джобу из хранилища (легаси удалял запись из Map спустя 60с после завершения). */
    delete(id: string): void;
}

export const PRICE_IMPORT_JOB_STORE = Symbol('PRICE_IMPORT_JOB_STORE');

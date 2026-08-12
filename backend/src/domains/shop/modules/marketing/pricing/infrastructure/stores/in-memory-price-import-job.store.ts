import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import type { PriceImportJobStore } from '../../application/ports/price-import-job-store.port';
import type { PriceImportJob } from '../../domain/entities/price-import-job.entity';

interface JobEntry {
    job: PriceImportJob;
    subject: Subject<PriceImportJob>;
}

// In-memory реализация PRICE_IMPORT_JOB_STORE (Фаза 9) — прямой перенос
// PriceMonitoringProgressService (src/TODO/priceMonitoring/priceMonitoring.progress.service.ts):
// та же пара Map + rxjs.Subject, PRD явно оставляет это in-memory на эту итерацию (см. раздел
// "не в скоупе" — персистентная джоба не заводится). Разница с легаси — Subject теперь несёт
// снапшот всего агрегата `PriceImportJob`, а не голый `{step, message, status}`, и завершается
// автоматически, когда джоба доходит до терминального статуса (в легаси это делал вызывающий код
// в `finally` пайплайна, здесь — сам стор, реагируя на save()).
//
// ⚠️ `PriceImportJob` — мутируемый агрегат: один и тот же объект (`entry.job`) переиспользуется на
// каждый `save()` вызывающей стороны, а не пересоздаётся. Подписчик `subscribe()` обязан прочитать/
// сериализовать нужные поля синхронно внутри своего обработчика `next` (как и делает будущий SSE-
// контроллер, Фаза 10) — откладывать чтение (буферизовать сами объекты для чтения позже) нельзя:
// к моменту отложенного чтения объект может уже отражать более позднее состояние джобы.
@Injectable()
export class InMemoryPriceImportJobStore implements PriceImportJobStore {
    private readonly jobs = new Map<string, JobEntry>();

    save(job: PriceImportJob): void {
        let entry = this.jobs.get(job.id);
        if (!entry) {
            entry = { job, subject: new Subject<PriceImportJob>() };
            this.jobs.set(job.id, entry);
        } else {
            entry.job = job;
        }

        entry.subject.next(job);
        if (job.isCompleted() || job.isFailed()) {
            entry.subject.complete();
        }
    }

    findById(id: string): PriceImportJob | undefined {
        return this.jobs.get(id)?.job;
    }

    subscribe(id: string): Observable<PriceImportJob> | undefined {
        return this.jobs.get(id)?.subject.asObservable();
    }

    delete(id: string): void {
        this.jobs.delete(id);
    }
}

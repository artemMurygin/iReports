import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { JobProgressEvent } from './priceMonitoring.types';

interface JobEntry {
    subject: Subject<JobProgressEvent>;
    latest: JobProgressEvent | null;
}

@Injectable()
export class PriceMonitoringProgressService {
    private readonly jobs = new Map<string, JobEntry>();

    create(uuid: string): Subject<JobProgressEvent> {
        const subject = new Subject<JobProgressEvent>();
        this.jobs.set(uuid, { subject, latest: null });
        return subject;
    }

    emit(uuid: string, event: JobProgressEvent): void {
        const job = this.jobs.get(uuid);
        if (!job) return;
        job.latest = event;
        job.subject.next(event);
    }

    getLatest(uuid: string): JobProgressEvent | null | undefined {
        return this.jobs.get(uuid)?.latest;
    }

    getSubject(uuid: string): Subject<JobProgressEvent> | undefined {
        return this.jobs.get(uuid)?.subject;
    }

    has(uuid: string): boolean {
        return this.jobs.has(uuid);
    }

    delete(uuid: string): void {
        this.jobs.delete(uuid);
    }
}

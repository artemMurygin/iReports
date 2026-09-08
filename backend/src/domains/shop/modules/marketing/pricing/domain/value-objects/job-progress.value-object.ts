import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

export interface JobProgressProps {
    stage: string;
    processed: number;
    total: number;
    message: string;
}

// Снапшот прогресса джобы импорта цен (см. PriceImportJob.updateProgress) — доменная замена
// голого `JobProgressEvent` (`{ step, message, status }`) из легаси
// (src/TODO/priceMonitoring/priceMonitoring.types.ts,
// PriceMonitoringProgressService.emit) — вместо строкового `status`
// ('progress'|'done'|'error') прогресс внутри пайплайна выражается количественно
// (processed/total), а done/error теперь сами статусы агрегата (COMPLETED/FAILED), а не
// значение внутри прогресса.
export class JobProgress extends ValueObject<JobProgressProps> {
    static create(props: JobProgressProps): JobProgress {
        if (!props.stage.trim()) {
            throw new ArgumentInvalidException(
                'stage прогресса не может быть пустым',
            );
        }
        if (!props.message.trim()) {
            throw new ArgumentInvalidException(
                'message прогресса не может быть пустым',
            );
        }
        if (!Number.isInteger(props.processed) || props.processed < 0) {
            throw new ArgumentInvalidException(
                `processed должен быть неотрицательным целым числом, получено: ${props.processed}`,
            );
        }
        if (!Number.isInteger(props.total) || props.total < 0) {
            throw new ArgumentInvalidException(
                `total должен быть неотрицательным целым числом, получено: ${props.total}`,
            );
        }
        if (props.processed > props.total) {
            throw new ArgumentInvalidException(
                `processed (${props.processed}) не может превышать total (${props.total})`,
            );
        }

        return new JobProgress({ ...props });
    }

    getStage(): string {
        return this.props.stage;
    }

    getProcessed(): number {
        return this.props.processed;
    }

    getTotal(): number {
        return this.props.total;
    }

    getMessage(): string {
        return this.props.message;
    }

    /** Доля выполнения [0, 1]; null — total ещё неизвестен (этап без счётчика позиций). */
    getPercent(): number | null {
        return this.props.total === 0
            ? null
            : this.props.processed / this.props.total;
    }
}

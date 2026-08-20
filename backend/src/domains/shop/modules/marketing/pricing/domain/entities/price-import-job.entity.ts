import { randomUUID } from 'crypto';
import { AggregateRoot } from '@/shared/domain/aggregate-root.base';
import { AggregateID } from '@/shared/domain/entity.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { JobProgress } from '../value-objects/job-progress.value-object';
import { ProductMatch } from '../value-objects/product-match.value-object';
import { CostChange } from '../value-objects/cost-change.value-object';
import {
    PriceImportJobAlreadyStartedException,
    PriceImportJobNotRunningException,
} from '../exceptions/price-import-job.exception';
import { PriceImportJobCompletedDomainEvent } from '../events/price-import-job-completed.domain-event';
import { PriceImportJobFailedDomainEvent } from '../events/price-import-job-failed.domain-event';

export type PriceImportJobStatus =
    'CREATED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface PriceImportJobResult {
    readonly matches: ProductMatch[];
    readonly costChanges: CostChange[];
}

export interface PriceImportJobProps {
    status: PriceImportJobStatus;
    progress: JobProgress | null;
    result: PriceImportJobResult | null;
    errorMessage: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
}

// Единственный настоящий агрегат всего рефакторинга TODO/priceMonitoring (см. PRD, раздел 3а) —
// доменное ядро джобы импорта закупочных цен магазина из XLSX. В легаси состояние джобы жило как
// голая пара `Map<string, JobEntry>` + `rxjs.Subject` в PriceMonitoringProgressService
// (src/TODO/priceMonitoring/priceMonitoring.progress.service.ts) без единого места, фиксирующего,
// какие переходы статуса вообще допустимы — эта сущность делает их явными инвариантами вместо
// "что код сделал, то и произошло". Хранение/публикация состояния между HTTP-запросами (SSE,
// поллинг) — ответственность порта PRICE_IMPORT_JOB_STORE (Фаза 9), сюда не входит: агрегат
// ничего не знает о том, что он персистится или сериализуется.
export class PriceImportJob extends AggregateRoot<PriceImportJobProps> {
    declare protected readonly _id: AggregateID;

    // `id` — опциональный, по умолчанию генерируется здесь же (`randomUUID()`), как и раньше.
    // Явная передача нужна интерфейс-слою (Фаза 10): HTTP-контроллер `POST .../import-costs`
    // обязан ответить `{ id }` до завершения пайплайна (fire-and-forget, `void
    // this.commandBus.execute(command)`), а сам id известен раньше, чем отработает
    // `StartPriceImportHandler` — это `command.id` (базовый `Command.id`, см.
    // `@/shared/domain/command.base.ts`, поле специально документировано как "для целей
    // корреляции"), который хендлер передаёт сюда, чтобы id команды и id джобы совпадали и
    // ответ контроллера сразу был валиден для последующих поллинга/SSE.
    static create(id: string = randomUUID()): PriceImportJob {
        return new PriceImportJob({
            id,
            props: {
                status: 'CREATED',
                progress: null,
                result: null,
                errorMessage: null,
                startedAt: null,
                finishedAt: null,
            },
        });
    }

    get status(): PriceImportJobStatus {
        return this.props.status;
    }

    get progress(): JobProgress | null {
        return this.props.progress;
    }

    get result(): PriceImportJobResult | null {
        return this.props.result;
    }

    get errorMessage(): string | null {
        return this.props.errorMessage;
    }

    get startedAt(): Date | null {
        return this.props.startedAt;
    }

    get finishedAt(): Date | null {
        return this.props.finishedAt;
    }

    isCreated(): boolean {
        return this.props.status === 'CREATED';
    }

    isRunning(): boolean {
        return this.props.status === 'RUNNING';
    }

    isCompleted(): boolean {
        return this.props.status === 'COMPLETED';
    }

    isFailed(): boolean {
        return this.props.status === 'FAILED';
    }

    // CREATED -> RUNNING, один раз за жизнь джобы. Повторный запуск — в т.ч. джобы, уже
    // завершившейся COMPLETED/FAILED, — запрещён: новая попытка импорта означает новую джобу
    // (новый id), а не реюз старой.
    start(): void {
        if (!this.isCreated()) {
            throw new PriceImportJobAlreadyStartedException(
                this.id,
                this.status,
            );
        }
        this.props.status = 'RUNNING';
        this.props.startedAt = new Date();
    }

    // Снапшот прогресса пайплайна (перенос смысла PriceMonitoringProgressService.emit) — допустим
    // только пока джоба реально выполняется: прогресс у ещё не запущенной или уже завершённой
    // джобы был бы противоречием состоянию.
    updateProgress(progress: JobProgress): void {
        if (!this.isRunning()) {
            throw new PriceImportJobNotRunningException(this.id, this.status);
        }
        this.props.progress = progress;
    }

    // RUNNING -> COMPLETED. Нельзя завершить незапущенную (CREATED) джобу и нельзя завершить уже
    // завершённую/упавшую джобу повторно.
    complete(result: PriceImportJobResult): void {
        if (!this.isRunning()) {
            throw new PriceImportJobNotRunningException(this.id, this.status);
        }
        this.props.status = 'COMPLETED';
        this.props.result = result;
        this.props.finishedAt = new Date();
        this.addEvent(
            new PriceImportJobCompletedDomainEvent({
                aggregateId: this.id,
                matchedCount: result.matches.length,
                updatedCount: result.costChanges.length,
            }),
        );
    }

    // RUNNING -> FAILED. Симметрично complete(): падение незапущенной или уже завершённой джобы —
    // тоже нелегальный переход (в легаси `emit('error', ...)` вызывался из общего `catch`,
    // который технически мог сработать в любой момент пайплайна — здесь это явно ограничено
    // состоянием RUNNING).
    fail(errorMessage: string): void {
        if (!this.isRunning()) {
            throw new PriceImportJobNotRunningException(this.id, this.status);
        }
        if (!errorMessage.trim()) {
            throw new ArgumentInvalidException(
                'errorMessage не может быть пустым',
            );
        }
        this.props.status = 'FAILED';
        this.props.errorMessage = errorMessage;
        this.props.finishedAt = new Date();
        this.addEvent(
            new PriceImportJobFailedDomainEvent({
                aggregateId: this.id,
                errorMessage,
            }),
        );
    }

    validate(): void {
        // status типизирован через `string`, а не напрямую props.status — после исчерпывающей
        // проверки TS сужает literal-union до `never`, и eslint (restrict-template-expressions)
        // не даёт подставить его в шаблонную строку (тот же приём, что в
        // AccountingPeriod.validate()).
        const status: string = this.props.status;
        if (
            status !== 'CREATED' &&
            status !== 'RUNNING' &&
            status !== 'COMPLETED' &&
            status !== 'FAILED'
        ) {
            throw new ArgumentInvalidException(
                `Недопустимый статус джобы импорта цен: "${status}"`,
            );
        }
    }
}

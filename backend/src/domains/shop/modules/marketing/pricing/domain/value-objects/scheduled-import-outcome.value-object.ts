import { ValueObject } from '@/shared/domain/value-object.base';

export type ScheduledImportOutcomeKind = 'uploaded' | 'unchanged' | 'failed';

export interface ScheduledImportOutcomeProps {
    kind: ScheduledImportOutcomeKind;
    reason: string | null;
}

/** Итог одного автоматического запуска выгрузки прайса. */
export class ScheduledImportOutcome extends ValueObject<ScheduledImportOutcomeProps> {
    static uploaded(): ScheduledImportOutcome {
        return new ScheduledImportOutcome({ kind: 'uploaded', reason: null });
    }

    static unchanged(): ScheduledImportOutcome {
        return new ScheduledImportOutcome({ kind: 'unchanged', reason: null });
    }

    /** `reason` — только для журнала сервера, в Telegram не уходит. */
    static failed(reason: string): ScheduledImportOutcome {
        return new ScheduledImportOutcome({ kind: 'failed', reason });
    }

    getKind(): ScheduledImportOutcomeKind {
        return this.props.kind;
    }

    getReason(): string | null {
        return this.props.reason;
    }
}

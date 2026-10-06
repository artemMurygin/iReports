import { ScheduledImportOutcome } from './scheduled-import-outcome.value-object';

describe('ScheduledImportOutcome', () => {
    it('фабрики задают kind', () => {
        expect(ScheduledImportOutcome.uploaded().getKind()).toBe('uploaded');
        expect(ScheduledImportOutcome.unchanged().getKind()).toBe('unchanged');
        const failed = ScheduledImportOutcome.failed('нет файла');
        expect(failed.getKind()).toBe('failed');
        expect(failed.getReason()).toBe('нет файла');
    });

    it('uploaded/unchanged без причины', () => {
        expect(ScheduledImportOutcome.uploaded().getReason()).toBeNull();
    });
});

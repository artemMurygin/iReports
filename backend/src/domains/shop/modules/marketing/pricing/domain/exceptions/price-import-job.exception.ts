import { ConflictException } from '@/shared/exceptions';

export class PriceImportJobAlreadyStartedException extends ConflictException {
    constructor(jobId: string, status: string) {
        super(
            `Джоба импорта цен ${jobId} уже запущена или завершена (текущий статус: ${status}) — повторный запуск невозможен`,
        );
    }
}

export class PriceImportJobNotRunningException extends ConflictException {
    constructor(jobId: string, status: string) {
        super(
            `Джоба импорта цен ${jobId} сейчас не выполняется (текущий статус: ${status}) — операция недоступна`,
        );
    }
}

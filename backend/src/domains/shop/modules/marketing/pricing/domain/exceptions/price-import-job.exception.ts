import { ConflictException, NotFoundException } from '@/shared/exceptions';

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

// HTTP-слой (Фаза 10): статус/SSE-эндпоинты получают `id` из URL, а не из
// доверенного внутреннего вызова — id, которого нет в `PRICE_IMPORT_JOB_STORE`
// (опечатка, устаревшая ссылка, джоба уже удалена), должен отвечать `404`, а не
// падать как конфликт состояния (это не про переходы статуса джобы, а про её
// отсутствие).
export class PriceImportJobNotFoundException extends NotFoundException {
    constructor(jobId: string) {
        super(`Джоба импорта цен ${jobId} не найдена`);
    }
}

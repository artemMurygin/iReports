import type { PriceImportJobStatusResponse } from 'ireports-contracts';
import type { PriceImportJob } from '../../domain/entities/price-import-job.entity';

// Снапшот агрегата -> DTO контракта (Фаза 10) — единая точка маппинга,
// переиспользуемая и `GET .../import-costs/:id/status` (разовый снапшот), и
// SSE `GET .../import-costs/:id` (тот же маппинг на каждое сообщение потока),
// чтобы форма ответа полностью совпадала между поллингом и стримом.
// `result` (matches/costChanges) сюда сознательно не попадает — итог пайплайна
// уходит в Google Sheets (см. RESULT_SHEET_GATEWAY, Фаза 9), а не наружу по
// HTTP; статус/прогресс/ошибка — то немногое, что нужно клиенту, чтобы
// показать прогресс-бар.
export function toPriceImportJobStatusResponse(
    job: PriceImportJob,
): PriceImportJobStatusResponse {
    const progress = job.progress;

    return {
        id: job.id,
        status: job.status,
        progress: progress
            ? {
                  stage: progress.getStage(),
                  processed: progress.getProcessed(),
                  total: progress.getTotal(),
                  message: progress.getMessage(),
                  percent: progress.getPercent(),
              }
            : null,
        errorMessage: job.errorMessage,
    };
}

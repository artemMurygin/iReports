import pino from 'pino';
import { buildPinoBaseOptions } from './pino.config';

/**
 * Используется вне Nest DI (чистые функции без доступа к конструктору),
 * например priceMonitoring.prompts.ts. Конфиг идентичен тому, что LoggerModule
 * использует для всего остального приложения (redact/level/транспорт в Loki).
 */
export const rootLogger = pino(buildPinoBaseOptions());

import * as fs from 'fs';
import * as path from 'path';

const LOG_PATH = path.join(__dirname, 'cron-errors.log');

export function logCronError(
    context: string,
    error: unknown,
    meta?: Record<string, unknown>,
) {
    const timestamp = new Date().toISOString();
    const err = error instanceof Error ? error : new Error(String(error));

    const entry = [
        `[${timestamp}] ${context}`,
        `  message: ${err.message}`,
        meta ? `  meta: ${JSON.stringify(meta)}` : null,
        err.stack ? `  stack: ${err.stack}` : null,
        '',
    ]
        .filter((line) => line !== null)
        .join('\n');

    fs.appendFileSync(LOG_PATH, entry + '\n', 'utf8');
}

/**
 * Base URL of the backend API. Server-side Apps Script code (`processFile` in the reference
 * `index.gs`) already posts to this same host via `UrlFetchApp` — this constant is the one
 * client-side use of it, needed to build the SSE progress-stream URL in the browser
 * (see `./progressStream.ts`).
 */
export const BASE_URL = 'https://36cd-45-145-40-211.ngrok-free.app'

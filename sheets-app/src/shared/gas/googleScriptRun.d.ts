/**
 * Ambient shape for `google.script.run`, the Apps Script HtmlService bridge to
 * server-side `.gs` functions. There is no official TypeScript typing for it —
 * it's a dynamic fluent builder (`withSuccessHandler`/`withFailureHandler` return
 * an object with the same shape plus one callable method per server function),
 * so this declaration is intentionally permissive rather than pretending to be
 * fully typed. Only present when the sidebar is served by real Apps Script
 * HtmlService; absent in local dev, which is what `isGasEnvironment` detects.
 */
export {}

declare global {
    interface GoogleScriptRunHandlers {
        withSuccessHandler(callback: (value: unknown) => void): GoogleScriptRunHandlers
        withFailureHandler(callback: (error: unknown) => void): GoogleScriptRunHandlers
        withUserObject(userObject: unknown): GoogleScriptRunHandlers
        // Every exposed server-side function name becomes a callable property at runtime.
        [fnName: string]: unknown
    }

    interface Window {
        google?: {
            script?: {
                run?: GoogleScriptRunHandlers
                [key: string]: unknown
            }
        }
    }
}

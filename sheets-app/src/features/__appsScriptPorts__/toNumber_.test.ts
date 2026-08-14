import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

/**
 * `toNumber_` — the pure numeric-string parser ported from
 * `frontend/GoogleSheetsInterface/index.gs` (lines ~129-136) to
 * `apps-script/src/toNumber_.ts` — has zero Apps Script API dependency, so it's tested here from
 * plain Vitest instead of needing a live Sheets/Apps Script environment.
 *
 * It is NOT imported with a normal `import` statement. `apps-script/src/toNumber_.ts` must stay
 * free of `import`/`export` syntax to be valid Apps Script source (Apps Script's V8 runtime
 * concatenates every project file into one global scope and can't parse ES module syntax — see
 * `apps-script/README.md`), so there is nothing for an `import` to bind to.
 *
 * Rather than hand-copy the function body into this test (a copy that could silently drift from
 * the real source the next time someone edits toNumber_.ts), this reads the actual file off disk,
 * strips its TypeScript types with the `typescript` compiler API (already a devDependency here),
 * and runs the exact same source text in a sandboxed `vm` context to obtain a callable reference.
 * That means this test always exercises the real, shipped implementation.
 */
function loadToNumber_(): (value: unknown) => number | null {
    const testDir = path.dirname(fileURLToPath(import.meta.url))
    const sourcePath = path.resolve(testDir, '../../../apps-script/src/toNumber_.ts')
    const source = readFileSync(sourcePath, 'utf-8')

    const { outputText, diagnostics } = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2019, strict: true },
        fileName: sourcePath,
        reportDiagnostics: true,
    })
    if (diagnostics && diagnostics.length > 0) {
        throw new Error(
            `Failed to transpile ${sourcePath}:\n` +
                diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'),
        )
    }

    const sandbox: { toNumber_?: (value: unknown) => number | null } = {}
    vm.createContext(sandbox)
    vm.runInContext(outputText, sandbox, { filename: sourcePath })

    if (typeof sandbox.toNumber_ !== 'function') {
        throw new Error(`Expected ${sourcePath} to declare a top-level toNumber_ function`)
    }
    return sandbox.toNumber_
}

const toNumber_ = loadToNumber_()

describe('toNumber_ (ported from apps-script/src/toNumber_.ts)', () => {
    it('passes finite numbers through unchanged', () => {
        expect(toNumber_(5)).toBe(5)
        expect(toNumber_(0)).toBe(0)
        expect(toNumber_(-12.5)).toBe(-12.5)
    })

    it('rejects non-finite numbers', () => {
        expect(toNumber_(Infinity)).toBeNull()
        expect(toNumber_(-Infinity)).toBeNull()
        expect(toNumber_(NaN)).toBeNull()
    })

    it('parses plain numeric strings', () => {
        expect(toNumber_('1234')).toBe(1234)
        expect(toNumber_('0')).toBe(0)
        expect(toNumber_('-7')).toBe(-7)
    })

    it('strips regular and non-breaking spaces (thousands separators)', () => {
        expect(toNumber_('1 234')).toBe(1234)
        expect(toNumber_('1 234 567')).toBe(1234567)
    })

    it('treats a comma as the decimal separator', () => {
        expect(toNumber_('12,5')).toBe(12.5)
        expect(toNumber_('1 234,5')).toBe(1234.5)
    })

    it('rejects empty and whitespace-only strings', () => {
        expect(toNumber_('')).toBeNull()
        expect(toNumber_('   ')).toBeNull()
    })

    it('rejects non-numeric strings', () => {
        expect(toNumber_('abc')).toBeNull()
        expect(toNumber_('12abc')).toBeNull()
    })

    it('rejects null, undefined, booleans, and objects', () => {
        expect(toNumber_(null)).toBeNull()
        expect(toNumber_(undefined)).toBeNull()
        expect(toNumber_(true)).toBeNull()
        expect(toNumber_({})).toBeNull()
        expect(toNumber_([])).toBeNull()
    })
})

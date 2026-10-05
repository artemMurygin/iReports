// Implements FR11 of sheets-app-redesign: last-run persistence of apps-script/src/lastRun.ts, run in a `vm` sandbox
// with a fake PropertiesService (same approach as toNumber_.test.ts).
import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

interface Report {
    operation: string
    status: 'success' | 'error'
    finishedAt: number
    counters?: Record<string, number>
    message?: string
    errors?: string[]
}

interface Ports {
    getLastRun(op: string): Report | null
    saveLastRun(report: Report): string
    getAllLastRuns(): Record<string, Report>
}

let store: Record<string, string>

function load(): Ports {
    const dir = path.dirname(fileURLToPath(import.meta.url))
    const sourcePath = path.resolve(dir, '../../../apps-script/src/lastRun.ts')
    const { outputText } = ts.transpileModule(readFileSync(sourcePath, 'utf-8'), {
        compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2019, strict: true },
        fileName: sourcePath,
    })
    const sandbox = {
        PropertiesService: {
            getDocumentProperties: () => ({
                getProperty: (k: string) => store[k] ?? null,
                setProperty: (k: string, v: string) => {
                    if (v.length > 9000) throw new Error('Value too large')
                    store[k] = v
                },
                getProperties: () => ({ ...store }),
            }),
        },
    }
    vm.createContext(sandbox)
    // `const`/`function` declarations of a script live in the context's global lexical scope: expose them explicitly.
    vm.runInContext(outputText + '\nthis.__ports = { getLastRun, saveLastRun, getAllLastRuns }', sandbox)
    return (sandbox as unknown as { __ports: Ports }).__ports
}

beforeEach(() => {
    store = {}
})

describe('lastRun (Apps Script)', () => {
    it('FR11: round-trips a report through getDocumentProperties', () => {
        const p = load()
        const report: Report = {
            operation: 'ro.uploadPrices',
            status: 'success',
            finishedAt: 10,
            counters: { total: 3 },
        }
        expect(p.saveLastRun(report)).toBe('OK')
        expect(p.getLastRun('ro.uploadPrices')).toEqual(report)
        expect(p.getLastRun('ms.load')).toBeNull()
    })

    it('FR11: getAllLastRuns returns only lastRun.* keys keyed by operation', () => {
        const p = load()
        store['unrelated'] = 'x'
        p.saveLastRun({ operation: 'ms.load', status: 'error', finishedAt: 1 })
        p.saveLastRun({ operation: 'ms.uploadRc', status: 'success', finishedAt: 2 })
        expect(Object.keys(p.getAllLastRuns()).sort()).toEqual(['ms.load', 'ms.uploadRc'])
    })

    it('FR11: clamps errors and message so a value stays far below the 9 KB limit', () => {
        const p = load()
        p.saveLastRun({
            operation: 'ro.createServices',
            status: 'error',
            finishedAt: 1,
            message: 'm'.repeat(5000),
            errors: Array.from({ length: 50 }, () => 'e'.repeat(1000)),
        })
        const saved = p.getLastRun('ro.createServices')!
        expect(saved.errors).toHaveLength(5)
        expect(saved.errors![0].length).toBeLessThanOrEqual(200)
        expect(saved.message!.length).toBeLessThanOrEqual(500)
        expect(store['lastRun.ro.createServices'].length).toBeLessThan(2000)
    })

    it('FR11: rejects invalid operation ids and statuses; ignores corrupt stored values', () => {
        const p = load()
        expect(() => p.saveLastRun({ operation: 'bad key!', status: 'success', finishedAt: 1 })).toThrow()
        expect(() => p.saveLastRun({ operation: 'ok', status: 'weird' as 'success', finishedAt: 1 })).toThrow()
        store['lastRun.broken'] = '{not json'
        expect(p.getLastRun('broken')).toBeNull()
        expect(p.getAllLastRuns()).toEqual({})
    })
})

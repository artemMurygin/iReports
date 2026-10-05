import { describe, expect, it } from 'vitest'
import { detectGasEnvironment } from './index'
import { decodeGasError } from './realClient'
import { GasHttpError } from './types'

describe('detectGasEnvironment', () => {
    it('returns false when window is undefined (SSR-ish / non-browser)', () => {
        expect(detectGasEnvironment(undefined)).toBe(false)
    })

    it('returns false when window.google is absent (plain local dev browser)', () => {
        expect(detectGasEnvironment({})).toBe(false)
    })

    it('returns false when window.google.script is present but run is missing', () => {
        expect(detectGasEnvironment({ google: { script: {} } })).toBe(false)
    })

    it('returns false when window.google.script.run is explicitly undefined', () => {
        expect(detectGasEnvironment({ google: { script: { run: undefined } } })).toBe(false)
    })

    it('returns true when window.google.script.run is defined (real Apps Script HtmlService context)', () => {
        expect(detectGasEnvironment({ google: { script: { run: {} } } })).toBe(true)
    })
})

// FR12: webhook failures arrive as a marked JSON message and are decoded into a GasHttpError.
describe('decodeGasError', () => {
    it('decodes the GAS_HTTP_ERROR marker into a structured error', () => {
        const decoded = decodeGasError(new Error('Exception: GAS_HTTP_ERROR:{"code":429,"message":"Too Many"}'))
        expect(decoded).toBeInstanceOf(GasHttpError)
        expect(decoded).toMatchObject({ code: 429, message: 'Too Many' })
    })

    it('decodes the marker when Apps Script appends a stack after the JSON', () => {
        const text =
            'ScriptError: Error: GAS_HTTP_ERROR:{"code":504,"message":"<html>\\r\\n504 Gateway Time-out</html>"}\n    at fetchWebhook_(Code:71:15)\n    at uploadPricesToMS(Code:93:12)'
        expect(decodeGasError(new Error(text))).toMatchObject({ code: 504 })
    })

    it('passes other errors through untouched', () => {
        const err = new Error('boom')
        expect(decodeGasError(err)).toBe(err)
        const broken = new Error('GAS_HTTP_ERROR:{oops')
        expect(decodeGasError(broken)).toBe(broken)
    })
})

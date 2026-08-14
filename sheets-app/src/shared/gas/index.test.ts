import { describe, expect, it } from 'vitest'
import { detectGasEnvironment } from './index'

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

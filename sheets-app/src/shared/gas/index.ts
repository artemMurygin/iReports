import type { GasApi } from './types'
import { realGasClient } from './realClient'
import { mockGasClient } from './mockClient'

export type { GasApi } from './types'
export type {
    AccrualsSheetEntry,
    CreateServiceInRoappResult,
    CreateServiceRow,
    ServiceCategory,
    UploadPricesToRoCount,
    UploadPricesToRoResult,
} from './types'

/** Minimal shape `detectGasEnvironment` needs from a `window`-like object. */
export interface GasEnvironmentCandidate {
    google?: {
        script?: {
            run?: unknown
        }
    }
}

/**
 * Pure predicate: does `win` look like a real Apps Script HtmlService context?
 * Factored out of module-load-time branching so it can be unit tested directly
 * against arbitrary fake `window`-shaped objects, without touching the real
 * global `window`.
 */
export function detectGasEnvironment(win: GasEnvironmentCandidate | undefined): boolean {
    return typeof win !== 'undefined' && typeof win.google?.script?.run !== 'undefined'
}

/** True when running inside a real Apps Script HtmlService sidebar (not local dev). */
export const isGasEnvironment: boolean = detectGasEnvironment(typeof window !== 'undefined' ? window : undefined)

/** The active GasApi implementation: real bridge in Apps Script, mock otherwise. */
export const gas: GasApi = isGasEnvironment ? realGasClient : mockGasClient

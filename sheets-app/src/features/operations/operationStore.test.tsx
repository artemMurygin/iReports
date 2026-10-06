// Implements FR11 of sheets-app-redesign: tests of the last-run persistence mapping and the provider hydration.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { gas } from '@/shared/gas'
import { fetchLastScheduledImport } from '@/shared/gas/progressStream'
import { OperationProvider } from './OperationProvider'
import { useOperationStore } from './operationContext'
import { useOperation } from './useOperation'
import { loadOperationRuns, reportFromState, saveOperationRun, stateFromReport } from './operationStore'

vi.mock('@/shared/gas', () => ({
    gas: { getAllLastRuns: vi.fn(), saveLastRun: vi.fn() },
}))

vi.mock('@/shared/gas/progressStream', () => ({
    fetchLastScheduledImport: vi.fn(),
}))

const mocked = vi.mocked(gas)
const mockedScheduled = vi.mocked(fetchLastScheduledImport)

beforeEach(() => {
    vi.clearAllMocks()
    mocked.getAllLastRuns.mockResolvedValue({})
    mocked.saveLastRun.mockResolvedValue('OK')
    mockedScheduled.mockResolvedValue(null)
})

describe('operationStore', () => {
    it('FR11: builds a report from a success state, keeping numeric counters only', () => {
        const report = reportFromState('ro.uploadPrices', {
            status: 'success',
            bannerOpen: false,
            finishedAt: 100,
            result: { total: 5, valid: 4, note: 'x' },
        })
        expect(report).toEqual({
            operation: 'ro.uploadPrices',
            status: 'success',
            finishedAt: 100,
            counters: { total: 5, valid: 4 },
        })
    })

    it('FR11, FR12: keeps the error code, title and detail', () => {
        const report = reportFromState('ms.load', {
            status: 'error',
            bannerOpen: true,
            finishedAt: 7,
            error: { code: '429', title: 'МойСклад ответил 429', detail: 'Слишком много запросов' },
        })
        expect(report).toMatchObject({ status: 'error', errorCode: '429', title: 'МойСклад ответил 429' })
        expect(stateFromReport(report!)).toMatchObject({
            status: 'error',
            finishedAt: 7,
            bannerOpen: false,
            error: { code: '429', title: 'МойСклад ответил 429', detail: 'Слишком много запросов' },
        })
    })

    it('FR11: does not persist idle or running states', async () => {
        await saveOperationRun('ms.load', { status: 'running', bannerOpen: false })
        expect(mocked.saveLastRun).not.toHaveBeenCalled()
    })

    it('FR11: a failing storage never throws', async () => {
        mocked.saveLastRun.mockRejectedValue(new Error('quota'))
        mocked.getAllLastRuns.mockRejectedValue(new Error('quota'))
        await expect(saveOperationRun('ms.load', { status: 'success', bannerOpen: false })).resolves.toBeUndefined()
        await expect(loadOperationRuns()).resolves.toEqual({})
    })

    // Scheduled (cron) price import: the backend remembers its result, the sidebar shows the newer of the two.
    it('shows the cron import time when the backend ran later than the stored manual run', async () => {
        mocked.getAllLastRuns.mockResolvedValue({
            'ms.import': { operation: 'ms.import', status: 'success', finishedAt: 100 },
        })
        mockedScheduled.mockResolvedValue({ status: 'success', finishedAt: 500 })
        const runs = await loadOperationRuns()
        expect(runs['ms.import']).toMatchObject({ status: 'success', finishedAt: 500, restored: true })
    })

    it('keeps the manual run when it is newer than the cron one', async () => {
        mocked.getAllLastRuns.mockResolvedValue({
            'ms.import': { operation: 'ms.import', status: 'success', finishedAt: 900 },
        })
        mockedScheduled.mockResolvedValue({ status: 'error', finishedAt: 500 })
        const runs = await loadOperationRuns()
        expect(runs['ms.import']).toMatchObject({ status: 'success', finishedAt: 900 })
    })

    it('uses the cron run when nothing is stored in the spreadsheet', async () => {
        mockedScheduled.mockResolvedValue({ status: 'error', finishedAt: 500 })
        const runs = await loadOperationRuns()
        expect(runs['ms.import']).toMatchObject({ status: 'error', finishedAt: 500 })
    })

    it('a failing cron lookup never breaks loading the stored runs', async () => {
        mocked.getAllLastRuns.mockResolvedValue({
            'ms.load': { operation: 'ms.load', status: 'success', finishedAt: 5 },
        })
        mockedScheduled.mockRejectedValue(new Error('network'))
        const runs = await loadOperationRuns()
        expect(runs['ms.load']).toMatchObject({ status: 'success', finishedAt: 5 })
        expect(runs['ms.import']).toBeUndefined()
    })

    it('a failing spreadsheet storage still shows the cron run', async () => {
        mocked.getAllLastRuns.mockRejectedValue(new Error('quota'))
        mockedScheduled.mockResolvedValue({ status: 'success', finishedAt: 500 })
        const runs = await loadOperationRuns()
        expect(runs['ms.import']).toMatchObject({ status: 'success', finishedAt: 500 })
    })
})

function Probe() {
    const { states } = useOperationStore()
    const op = useOperation('ms.load')
    return (
        <div>
            <span data-testid="status">{states['ms.load']?.status ?? 'none'}</span>
            <button onClick={() => void op.run(async () => 'OK')}>run</button>
        </div>
    )
}

describe('OperationProvider persistence', () => {
    it('FR11: restores statuses on open', async () => {
        mocked.getAllLastRuns.mockResolvedValue({
            'ms.load': { operation: 'ms.load', status: 'success', finishedAt: 5 },
        })
        render(
            <OperationProvider>
                <Probe />
            </OperationProvider>,
        )
        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('success'))
    })

    it('FR11: saves the run after it finishes', async () => {
        render(
            <OperationProvider>
                <Probe />
            </OperationProvider>,
        )
        await act(async () => {
            screen.getByText('run').click()
        })
        await waitFor(() =>
            expect(mocked.saveLastRun).toHaveBeenCalledWith(
                expect.objectContaining({ operation: 'ms.load', status: 'success' }),
            ),
        )
    })
})

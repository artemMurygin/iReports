// Implements the "reattach to a running import after reopening the sidebar" requirement of sheets-app: tests.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OperationProvider } from '@/features/operations/OperationProvider'
import { gas } from '@/shared/gas'
import { fetchActiveImportId, openImportProgressStream } from '@/shared/gas/progressStream'
import type { ProgressStreamHandlers } from '@/shared/gas/progressStream'
import { useResumeActiveImport } from './useResumeActiveImport'

vi.mock('@/shared/gas', () => ({
    gas: { cancelImport: vi.fn(), getAllLastRuns: vi.fn().mockResolvedValue({}), saveLastRun: vi.fn() },
}))

vi.mock('@/shared/gas/progressStream', () => ({
    openImportProgressStream: vi.fn(),
    fetchActiveImportId: vi.fn(),
}))

function Resume() {
    useResumeActiveImport()
    return null
}

function renderResume() {
    return render(
        <OperationProvider>
            <Resume />
        </OperationProvider>,
    )
}

describe('useResumeActiveImport', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(gas.getAllLastRuns).mockResolvedValue({})
    })

    it('shows the progress of a still-running import and reflects the stream status', async () => {
        vi.mocked(fetchActiveImportId).mockResolvedValue('uuid-7')
        vi.mocked(openImportProgressStream).mockImplementation((_uuid: string, handlers: ProgressStreamHandlers) => {
            handlers.onMessage('Сопоставление с номенклатурой...')
            return vi.fn()
        })

        renderResume()

        const modal = await screen.findByTestId('progress-modal')
        await waitFor(() =>
            expect(within(modal).getByTestId('progress-message')).toHaveTextContent('Сопоставление с номенклатурой...'),
        )
        expect(openImportProgressStream).toHaveBeenCalledWith('uuid-7', expect.any(Object))
    })

    it('does nothing when no import is running', async () => {
        vi.mocked(fetchActiveImportId).mockResolvedValue(null)
        renderResume()
        await waitFor(() => expect(fetchActiveImportId).toHaveBeenCalled())
        expect(screen.queryByTestId('progress-modal')).not.toBeInTheDocument()
        expect(openImportProgressStream).not.toHaveBeenCalled()
    })

    it('cancel on a resumed import stops the job on the server', async () => {
        const user = userEvent.setup()
        vi.mocked(fetchActiveImportId).mockResolvedValue('uuid-7')
        const close = vi.fn()
        vi.mocked(openImportProgressStream).mockReturnValue(close)

        renderResume()
        const modal = await screen.findByTestId('progress-modal')
        await user.click(within(modal).getByRole('button', { name: 'Отмена' }))

        expect(close).toHaveBeenCalledOnce()
        expect(gas.cancelImport).toHaveBeenCalledWith('uuid-7')
        await waitFor(() => expect(screen.queryByTestId('progress-modal')).not.toBeInTheDocument())
    })
})

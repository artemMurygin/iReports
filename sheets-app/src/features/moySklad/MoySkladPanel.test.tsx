import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MoySkladPanel } from './MoySkladPanel'
import type { GlassLoaderController } from '@/shared/gsheets-ui/useGlassLoaderController'
import { gas } from '@/shared/gas'
import { openImportProgressStream } from '@/shared/gas/progressStream'
import type { ProgressStreamHandlers } from '@/shared/gas/progressStream'

// MoySkladPanel talks to the server only through `gas` and `openImportProgressStream` — mocking
// those two boundaries keeps these tests off the network and off real timers (the mock progress
// stream normally uses setTimeout; here it's replaced outright and invokes handlers immediately).
vi.mock('@/shared/gas', () => ({
    gas: {
        processFile: vi.fn(),
        loadPricesFromMS: vi.fn(),
        uploadPricesToMS: vi.fn(),
        uploadSalePricesToMS: vi.fn(),
    },
}))

vi.mock('@/shared/gas/progressStream', () => ({
    openImportProgressStream: vi.fn(),
}))

function createLoader(): GlassLoaderController {
    return {
        active: false,
        statusText: '',
        logLines: [],
        show: vi.fn(),
        update: vi.fn(),
        addLog: vi.fn(),
        hide: vi.fn(),
    }
}

function makePriceFile(name = 'prices.xlsx'): File {
    return new File(['dummy content'], name, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
}

function getFileInput(container: HTMLElement): HTMLInputElement {
    return container.querySelector('input[type="file"]') as HTMLInputElement
}

describe('MoySkladPanel', () => {
    beforeEach(() => {
        vi.mocked(gas.processFile).mockReset()
        vi.mocked(gas.loadPricesFromMS).mockReset()
        vi.mocked(gas.uploadPricesToMS).mockReset()
        vi.mocked(gas.uploadSalePricesToMS).mockReset()
        vi.mocked(openImportProgressStream).mockReset()
    })

    it('shows a warning and makes no gas calls when uploading with no file selected', async () => {
        const user = userEvent.setup()
        const onStatus = vi.fn()
        render(<MoySkladPanel loader={createLoader()} onStatus={onStatus} />)

        await user.click(screen.getByRole('button', { name: 'Загрузить прайс' }))

        expect(onStatus).toHaveBeenCalledWith('⚠️ Выберите файл', 'warning')
        expect(gas.processFile).not.toHaveBeenCalled()
    })

    it('disables/relabels the upload button while in flight and shows success once the stream completes', async () => {
        const user = userEvent.setup()
        const onStatus = vi.fn()

        // Controlled instead of auto-resolving: lets the test observe the busy state while
        // processFile is still in flight, before letting it (and the mocked SSE stream) complete —
        // per the spec, the button must stay busy through the *whole* stream, not just this call.
        let resolveProcessFile!: (uuid: string) => void
        vi.mocked(gas.processFile).mockImplementation(
            () =>
                new Promise<string>((resolve) => {
                    resolveProcessFile = resolve
                }),
        )
        vi.mocked(openImportProgressStream).mockImplementation((_uuid: string, handlers: ProgressStreamHandlers) => {
            handlers.onMessage('Парсим файл...')
            handlers.onCompleted()
            return () => {}
        })

        const { container } = render(<MoySkladPanel loader={createLoader()} onStatus={onStatus} />)
        await user.upload(getFileInput(container), makePriceFile())
        await user.click(screen.getByRole('button', { name: 'Загрузить прайс' }))

        await waitFor(() => expect(gas.processFile).toHaveBeenCalledWith(expect.any(String)))
        expect(screen.getByRole('button', { name: 'Загрузка...' })).toBeDisabled()

        resolveProcessFile('uuid-123')

        await waitFor(() => {
            expect(onStatus).toHaveBeenCalledWith('✅ Готово!', 'success')
        })
        expect(screen.getByRole('button', { name: 'Загрузить прайс' })).not.toBeDisabled()
    })

    it('shows the server-provided error message on a FAILED progress event and resets the button', async () => {
        const user = userEvent.setup()
        const onStatus = vi.fn()
        vi.mocked(gas.processFile).mockResolvedValue('uuid-456')
        vi.mocked(openImportProgressStream).mockImplementation((_uuid: string, handlers: ProgressStreamHandlers) => {
            handlers.onFailed('Неверный формат файла')
            return () => {}
        })

        const { container } = render(<MoySkladPanel loader={createLoader()} onStatus={onStatus} />)
        await user.upload(getFileInput(container), makePriceFile())
        await user.click(screen.getByRole('button', { name: 'Загрузить прайс' }))

        await waitFor(() => {
            expect(onStatus).toHaveBeenCalledWith('❌ Неверный формат файла', 'error')
        })
        expect(screen.getByRole('button', { name: 'Загрузить прайс' })).not.toBeDisabled()
    })

    it('calls loadPricesFromMS and shows the matching success status on the sync button', async () => {
        const user = userEvent.setup()
        const onStatus = vi.fn()
        vi.mocked(gas.loadPricesFromMS).mockResolvedValue('OK')

        render(<MoySkladPanel loader={createLoader()} onStatus={onStatus} />)
        await user.click(screen.getByRole('button', { name: '⬇ Получить цены из МС' }))

        expect(gas.loadPricesFromMS).toHaveBeenCalledOnce()
        await waitFor(() => {
            expect(onStatus).toHaveBeenCalledWith('✅ РЦ загружена из МойСклад!', 'success')
        })
        expect(screen.getByRole('button', { name: '⬇ Получить цены из МС' })).not.toBeDisabled()
    })

    it('shows an error status when loadPricesFromMS rejects', async () => {
        const user = userEvent.setup()
        const onStatus = vi.fn()
        vi.mocked(gas.loadPricesFromMS).mockRejectedValue(new Error('Сеть недоступна'))

        render(<MoySkladPanel loader={createLoader()} onStatus={onStatus} />)
        await user.click(screen.getByRole('button', { name: '⬇ Получить цены из МС' }))

        await waitFor(() => {
            expect(onStatus).toHaveBeenCalledWith('❌ Сеть недоступна', 'error')
        })
        expect(screen.getByRole('button', { name: '⬇ Получить цены из МС' })).not.toBeDisabled()
    })
})

// Implements FR2, FR3, FR4, FR6, UX2 of sheets-app-redesign: tests of the "Мой склад" tab.
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MoySkladPanel } from './MoySkladPanel'
import { OperationProvider } from '@/features/operations/OperationProvider'
import { TooltipProvider } from '@/shared/ui/tooltip'
import { gas } from '@/shared/gas'
import { openImportProgressStream } from '@/shared/gas/progressStream'
import type { ProgressStreamHandlers } from '@/shared/gas/progressStream'

// MoySkladPanel talks to the server only through `gas` and `openImportProgressStream` — mocking
// those two boundaries keeps these tests off the network and off real timers.
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

function Harness({ initialFile = null }: { initialFile?: File | null }) {
    const [file, setFile] = useState<File | null>(initialFile)
    return (
        <TooltipProvider>
            <OperationProvider>
                <MoySkladPanel file={file} onFileChange={setFile} />
            </OperationProvider>
        </TooltipProvider>
    )
}

function makePriceFile(name = 'prices.xlsx'): File {
    return new File(['dummy content'], name, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
}

function runButton(id: string) {
    return within(screen.getByTestId(id)).getByRole('button', { name: /Запустить|Повторить/ })
}

describe('MoySkladPanel', () => {
    beforeEach(() => {
        vi.mocked(gas.processFile).mockReset()
        vi.mocked(gas.loadPricesFromMS).mockReset()
        vi.mocked(gas.uploadPricesToMS).mockReset()
        vi.mocked(gas.uploadSalePricesToMS).mockReset()
        vi.mocked(openImportProgressStream).mockReset()
    })

    it('FR2: shows Dropzone and the hardcoded requirements, three idle cards and no file card', () => {
        render(<Harness />)

        expect(screen.getByTestId('ms-dropzone')).toBeInTheDocument()
        expect(screen.getByRole('region', { name: 'Требования' })).toHaveTextContent(/Apple \(iPhone, Watch\)/)
        expect(screen.queryByTestId('ms-file-card')).not.toBeInTheDocument()
        expect(screen.queryByTestId('ms-upload-file')).not.toBeInTheDocument()
        for (const id of ['ms.uploadRc', 'ms.uploadSale', 'ms.load']) {
            expect(screen.getByTestId(id)).toHaveAttribute('data-status', 'idle')
        }
    })

    it('FR3: groups the functions by direction', () => {
        render(<Harness />)
        expect(screen.getAllByTestId('group-label').map((el) => el.textContent)).toEqual([
            'Отправить в МойСклад',
            'Получить из МойСклад',
        ])
    })

    it('FR2: a picked file turns Dropzone into a FileCard, Remove brings it back', async () => {
        const user = userEvent.setup()
        render(<Harness />)

        await user.upload(screen.getByTestId('ms-file-input'), makePriceFile('trade.xlsx'))
        expect(screen.getByTestId('ms-file-card')).toHaveTextContent('trade.xlsx')
        expect(screen.queryByTestId('ms-dropzone')).not.toBeInTheDocument()
        expect(screen.queryByTestId('ms-requirements')).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Убрать файл' }))
        expect(screen.getByTestId('ms-dropzone')).toBeInTheDocument()
        expect(screen.getByTestId('ms-requirements')).toBeInTheDocument()
    })

    it('UX2: a non-spreadsheet file shows a format warning and does not become the selected file', async () => {
        const user = userEvent.setup({ applyAccept: false })
        render(<Harness />)

        await user.upload(screen.getByTestId('ms-file-input'), new File(['x'], 'notes.pdf'))

        expect(screen.getByTestId('ms-warning')).toHaveTextContent(/Неподдерживаемый формат/)
        expect(screen.getByTestId('ms-dropzone')).toHaveAttribute('data-state', 'invalid')
        expect(screen.queryByTestId('ms-file-card')).not.toBeInTheDocument()
    })

    it('shows the upload button as busy through the whole stream and a success note once it completes', async () => {
        const user = userEvent.setup()
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

        render(<Harness initialFile={makePriceFile()} />)
        await user.click(screen.getByTestId('ms-upload-file'))

        await waitFor(() => expect(gas.processFile).toHaveBeenCalledWith(expect.any(String)))
        expect(screen.getByTestId('ms-upload-file')).toBeDisabled()
        expect(screen.getByTestId('ms-upload-file')).toHaveTextContent(/Загрузка/)

        resolveProcessFile('uuid-123')

        await waitFor(() => expect(screen.getByTestId('ms-import-status')).toHaveTextContent(/Прайс загружен/))
        expect(screen.getByTestId('ms-upload-file')).not.toBeDisabled()
        expect(screen.getByTestId('ms-upload-file')).toHaveTextContent('Загрузить прайс')
    })

    it('FR6: shows the server-provided message on a FAILED progress event and resets the button', async () => {
        const user = userEvent.setup()
        vi.mocked(gas.processFile).mockResolvedValue('uuid-456')
        vi.mocked(openImportProgressStream).mockImplementation((_uuid: string, handlers: ProgressStreamHandlers) => {
            handlers.onFailed('Неверный формат файла')
            return () => {}
        })

        render(<Harness initialFile={makePriceFile()} />)
        await user.click(screen.getByTestId('ms-upload-file'))

        await waitFor(() => expect(screen.getByTestId('ms-error')).toHaveTextContent(/Неверный формат файла/))
        expect(screen.getByTestId('ms-upload-file')).not.toBeDisabled()
    })

    it('FR4: runs a function and shows its success time in the card footer', async () => {
        const user = userEvent.setup()
        vi.mocked(gas.loadPricesFromMS).mockResolvedValue('OK')
        render(<Harness />)

        await user.click(runButton('ms.load'))

        expect(gas.loadPricesFromMS).toHaveBeenCalledOnce()
        await waitFor(() => expect(screen.getByTestId('ms.load')).toHaveAttribute('data-status', 'success'))
        expect(within(screen.getByTestId('ms.load')).getByTestId('func-status')).toHaveTextContent(/^\d{2}:\d{2}$/)
        expect(screen.getByTestId('ms.uploadRc')).toHaveAttribute('data-status', 'idle')
        expect(runButton('ms.load')).not.toBeDisabled()
    })

    it('FR4, FR6: a 429 marks only that card as failed and shows the matching banner; closing keeps the card error', async () => {
        const user = userEvent.setup()
        vi.mocked(gas.uploadPricesToMS).mockRejectedValue(
            new Error('Request failed for https://n8n returned code 429. Truncated server response: too many'),
        )
        render(<Harness />)

        await user.click(runButton('ms.uploadRc'))

        await waitFor(() => expect(screen.getByTestId('ms.uploadRc')).toHaveAttribute('data-status', 'error'))
        expect(within(screen.getByTestId('ms.uploadRc')).getByTestId('func-status')).toHaveTextContent(/ошибка 429/)
        expect(screen.getByTestId('ms-error')).toHaveTextContent('МойСклад ответил 429')
        expect(screen.getByTestId('ms-error')).toHaveTextContent('Слишком много запросов · повторите через минуту')
        expect(screen.getByTestId('ms.uploadSale')).toHaveAttribute('data-status', 'idle')

        await user.click(within(screen.getByTestId('ms-error')).getByRole('button', { name: 'Закрыть' }))
        expect(screen.queryByTestId('ms-error')).not.toBeInTheDocument()
        expect(screen.getByTestId('ms.uploadRc')).toHaveAttribute('data-status', 'error')
    })

    it('FR4: a retry after an error calls the function again', async () => {
        const user = userEvent.setup()
        vi.mocked(gas.uploadSalePricesToMS).mockRejectedValueOnce(new Error('Сеть недоступна'))
        vi.mocked(gas.uploadSalePricesToMS).mockResolvedValueOnce('OK')
        render(<Harness />)

        await user.click(runButton('ms.uploadSale'))
        await waitFor(() => expect(screen.getByTestId('ms.uploadSale')).toHaveAttribute('data-status', 'error'))

        await user.click(runButton('ms.uploadSale'))
        await waitFor(() => expect(screen.getByTestId('ms.uploadSale')).toHaveAttribute('data-status', 'success'))
        expect(gas.uploadSalePricesToMS).toHaveBeenCalledTimes(2)
    })

    it('keeps the selected file across a remount of the panel', () => {
        function Outer() {
            const [file, setFile] = useState<File | null>(makePriceFile('kept.xlsx'))
            const [show, setShow] = useState(true)
            return (
                <TooltipProvider>
                    <OperationProvider>
                        <button onClick={() => setShow((v) => !v)}>toggle</button>
                        {show && <MoySkladPanel file={file} onFileChange={setFile} />}
                    </OperationProvider>
                </TooltipProvider>
            )
        }
        render(<Outer />)
        expect(screen.getByTestId('ms-file-card')).toHaveTextContent('kept.xlsx')
    })

    it('FR9, FR13: SSE import shows the stream status and cancel closes the stream', async () => {
        const user = userEvent.setup()
        vi.mocked(gas.processFile).mockResolvedValue('uuid-1')
        const close = vi.fn()
        vi.mocked(openImportProgressStream).mockImplementation((_uuid: string, handlers: ProgressStreamHandlers) => {
            handlers.onMessage('Парсим файл...')
            return close
        })

        render(<Harness initialFile={makePriceFile()} />)
        await user.click(screen.getByTestId('ms-upload-file'))

        const modal = await screen.findByTestId('progress-modal')
        await waitFor(() => expect(within(modal).getByTestId('progress-message')).toHaveTextContent('Парсим файл...'))

        await user.click(within(modal).getByRole('button', { name: 'Отмена' }))

        expect(close).toHaveBeenCalledOnce()
        await waitFor(() => expect(screen.queryByTestId('progress-modal')).not.toBeInTheDocument())
        expect(screen.queryByTestId('ms-error')).not.toBeInTheDocument()
        expect(screen.queryByTestId('ms-import-status')).not.toBeInTheDocument()
    })

    it('FR9: a blocking webhook shows an indeterminate modal without status and cancel', async () => {
        const user = userEvent.setup()
        let finish!: (v: string) => void
        vi.mocked(gas.loadPricesFromMS).mockImplementation(() => new Promise((resolve) => (finish = resolve)))
        render(<Harness />)

        await user.click(runButton('ms.load'))
        const modal = await screen.findByTestId('progress-modal')
        expect(within(modal).getByText('Получаем цены из МойСклад')).toBeInTheDocument()
        expect(within(modal).queryByTestId('progress-message')).not.toBeInTheDocument()
        expect(within(modal).queryByRole('button', { name: 'Отмена' })).not.toBeInTheDocument()

        finish('OK')
        await waitFor(() => expect(screen.queryByTestId('progress-modal')).not.toBeInTheDocument())
    })
})

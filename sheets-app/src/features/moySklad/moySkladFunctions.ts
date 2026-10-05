import type { FuncTile } from '@/shared/gsheets-ui/FuncCard'
import type { FuncTooltipContent } from '@/shared/gsheets-ui/FuncTooltip'

export type MoySkladFunctionId = 'ms.uploadRc' | 'ms.uploadSale' | 'ms.load'

/** Operation id of the price-file import (SSE); it has no card, only the «Загрузить прайс» button. */
export const MS_IMPORT_ID = 'ms.import'

export interface MoySkladFunction {
    id: MoySkladFunctionId
    group: 'send' | 'receive'
    title: string
    description: string
    tile: FuncTile
    tooltip: FuncTooltipContent
    /** Title of the progress overlay while the function runs. */
    progressTitle: string
}

/** Implements FR3, FR5 of sheets-app-redesign: texts of the three МойСклад functions (kept out of JSX). */
export const MOY_SKLAD_FUNCTIONS: MoySkladFunction[] = [
    {
        id: 'ms.uploadRc',
        group: 'send',
        title: 'Обновить РЦ в МойСклад',
        description: 'Розничные цены из листа → карточки товаров',
        tile: 'brand',
        progressTitle: 'Выгружаем РЦ в МойСклад',
        tooltip: {
            title: 'Обновить РЦ в МойСклад',
            body: 'Берёт розничные цены из листа и записывает их в карточки товаров МойСклад.',
            meta: 'пишет в МойСклад',
        },
    },
    {
        id: 'ms.uploadSale',
        group: 'send',
        title: 'Обновить акционную РЦ',
        description: 'Цены по акции из листа → МойСклад',
        tile: 'brand',
        progressTitle: 'Выгружаем акционную цену в МойСклад',
        tooltip: {
            title: 'Обновить акционную РЦ',
            body: 'Записывает акционные цены из листа в МойСклад. Обычные розничные цены не меняются.',
            meta: 'пишет в МойСклад',
        },
    },
    {
        id: 'ms.load',
        group: 'receive',
        title: 'Получить цены из МойСклад',
        description: 'Актуальные цены запишутся в этот лист',
        tile: 'info',
        progressTitle: 'Получаем цены из МойСклад',
        tooltip: {
            title: 'Получить цены из МойСклад',
            body: 'Читает текущие цены из МойСклад и записывает их в этот лист.',
            meta: 'пишет в таблицу',
        },
    },
]

/** Title of the progress modal while the price file is imported (SSE). */
export const MS_IMPORT_PROGRESS_TITLE = 'Загружаем прайс в МойСклад'

/** Q8: hardcoded text of the «Требования» block. */
export const MS_REQUIREMENTS_TEXT = 'Нужны листы «Apple (iPhone, Watch)» и «Apple (iPad, Macbook)».'

export const MS_DROPZONE_TITLE = 'Перетащите файл сюда'
export const MS_DROPZONE_HINT = 'или нажмите, чтобы выбрать · .xlsx'

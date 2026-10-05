import type { FuncTile } from '@/shared/gsheets-ui/FuncCard'
import type { FuncTooltipContent } from '@/shared/gsheets-ui/FuncTooltip'

export type RemonlineFunctionId = 'ro.uploadPrices' | 'ro.createServices' | 'ro.accruals'

export interface RemonlineFunction {
    id: RemonlineFunctionId
    group: 'send' | 'receive'
    title: string
    description: string
    tile: FuncTile
    tooltip: FuncTooltipContent
    /** Title of the progress overlay while the function runs. */
    progressTitle: string
}

/** Implements FR3, FR5 of sheets-app-redesign: texts of the three Ремонлайн functions (kept out of JSX). */
export const REMONLINE_FUNCTIONS: RemonlineFunction[] = [
    {
        id: 'ro.uploadPrices',
        group: 'send',
        title: 'Загрузить цены в RO',
        description: 'Цены из листа → карточки услуг RemOnline',
        tile: 'brand',
        progressTitle: 'Выгружаем цены в RO',
        tooltip: {
            title: 'Загрузить цены в RO',
            body: 'Берёт цены из колонок листа и обновляет карточки услуг в RemOnline. Позиции без артикула пропускаются.',
            meta: 'пишет в RemOnline',
        },
    },
    {
        id: 'ro.createServices',
        group: 'send',
        title: 'Создать услуги в Ремонлайн',
        description: 'Добавит недостающие позиции каталога',
        tile: 'copper',
        progressTitle: 'Создаём услуги в Ремонлайн',
        tooltip: {
            title: 'Создать услуги в Ремонлайн',
            body: 'Добавляет в RemOnline услуги со значением «Создать» в листе. Обязательные поля описаны в README.',
            meta: 'пишет в RemOnline',
        },
    },
    {
        id: 'ro.accruals',
        group: 'receive',
        title: 'Обновить начисления мастеров',
        description: 'Начисления из RemOnline → в этот лист',
        tile: 'info',
        progressTitle: 'Обновляем начисления мастеров',
        tooltip: {
            title: 'Обновить начисления мастеров',
            body: 'Читает начисления мастеров из RemOnline и записывает их в этот лист.',
            meta: 'пишет в таблицу',
        },
    },
]

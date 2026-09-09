import { useState } from 'react'
import { PageHeader } from '@/shared/ui-kit/organisms/PageHeader.tsx'
import { Tabs, type TabItem } from '@/shared/ui-kit/molecules/Tabs.tsx'

import { ServiceGoodsTurnoverReport } from './ServiceGoodsTurnoverReport.tsx'
import { ShopGoodsTurnoverReport } from './ShopGoodsTurnoverReport.tsx'

type DirectionTab = 'service' | 'shop'

const TABS: TabItem[] = [
    { id: 'service', label: 'Сервис' },
    { id: 'shop', label: 'Магазин' },
]

/**
 * Страница `/goods-turnover-report` — общий заголовок + переключатель направления (`Tabs`,
 * `shared/ui-kit/molecules/Tabs.tsx`, тот же приём, что `PageHeader`/`Direction Row` на
 * `pages/SalesPlan`) над вкладками «Сервис» (`ServiceGoodsTurnoverReport`, было единственным
 * содержимым этой страницы, openspec/changes/service-turnover-report) и «Магазин»
 * (`ShopGoodsTurnoverReport`, merge feat/shopTurnOverReport) — обе вкладки самостоятельно ведут
 * свой запрос/фильтры/Refresh-переход, здесь только выбор, какая из них смонтирована (React не
 * держит стейт/не шлёт запросы немонтированной вкладки).
 *
 * Без условного рендера внутри веток («медиатор/страница не должен содержать условного рендера» —
 * `frontend/CLAUDE.md`) — единственное ветвление здесь ровно то, что и определяет tab-switcher
 * (какой из двух самодостаточных view смонтирован), сами view ничего не решают снаружи.
 */
export function GoodsTurnoverReportPage() {
    const [tab, setTab] = useState<DirectionTab>('service')

    return (
        <main className="flex flex-1 flex-col gap-4 bg-canvas px-4 py-5 md:px-7 md:py-6">
            <PageHeader
                title="Оборачиваемость товаров"
                subtitle="Расход и остаток по категориям справочника и складам за месяц"
            />
            <Tabs tabs={TABS} activeId={tab} onChange={(id) => setTab(id as DirectionTab)} />
            {tab === 'service' ? <ServiceGoodsTurnoverReport /> : <ShopGoodsTurnoverReport />}
        </main>
    )
}

import { useState } from 'react'
import { TooltipProvider } from '@/shared/ui/tooltip'
import { AppTabs, AppTabsContent } from '@/shared/gsheets-ui/AppTabs'
import { GlassLoader } from '@/shared/gsheets-ui/GlassLoader'
import { StatusLine } from '@/shared/gsheets-ui/StatusLine'
import type { StatusColor } from '@/shared/gsheets-ui/StatusLine'
import { useGlassLoaderController } from '@/shared/gsheets-ui/useGlassLoaderController'
import { MoySkladPanel } from '@/features/moySklad/MoySkladPanel'
import { RemonlinePanel } from '@/features/remonline/RemonlinePanel'

// Phase 3 — visual shell only. Phase 4 wired the "Мой склад" tab (see MoySkladPanel) up to the
// real gas bridge. Phase 5 wired the price-sync + accruals-sync buttons of the "Ремонлайн" tab
// (see RemonlinePanel); its create-services button/tooltip/add-service panel are still stubs —
// real wiring (category tree/etc, see frontend/GoogleSheetsInterface/index.html) lands later.

interface StatusState {
    message: string
    color: StatusColor
}

const EMPTY_STATUS: StatusState = { message: '', color: 'neutral' }

function App() {
    const [activeTab, setActiveTab] = useState('ms')
    const [status, setStatus] = useState<StatusState>(EMPTY_STATUS)
    const loader = useGlassLoaderController()

    function handleTabChange(value: string) {
        setActiveTab(value)
        setStatus(EMPTY_STATUS)
    }

    function setStatusMessage(message: string, color: StatusColor) {
        setStatus({ message, color })
    }

    return (
        <TooltipProvider>
            <GlassLoader active={loader.active} statusText={loader.statusText} logLines={loader.logLines} />

            <AppTabs
                value={activeTab}
                onValueChange={handleTabChange}
                tabs={[
                    { value: 'ms', label: 'Мой склад' },
                    { value: 'ro', label: 'Ремонлайн' },
                ]}
            >
                {/* ВКЛАДКА: МОЙ СКЛАД */}
                <AppTabsContent value="ms">
                    <MoySkladPanel loader={loader} onStatus={setStatusMessage} />
                </AppTabsContent>

                {/* ВКЛАДКА: РЕМОНЛАЙН */}
                <AppTabsContent value="ro">
                    <RemonlinePanel loader={loader} onStatus={setStatusMessage} />
                </AppTabsContent>
            </AppTabs>

            <StatusLine message={status.message} color={status.color} className="mt-3" />
        </TooltipProvider>
    )
}

export default App

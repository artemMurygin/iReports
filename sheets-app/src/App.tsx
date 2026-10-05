import { useState } from 'react'
import { TooltipProvider } from '@/shared/ui/tooltip'
import { AppHeader } from '@/shared/gsheets-ui/AppHeader'
import { AppTabs, AppTabsContent } from '@/shared/gsheets-ui/AppTabs'
import { OperationProvider } from '@/features/operations/OperationProvider'
import { MoySkladPanel } from '@/features/moySklad/MoySkladPanel'
import { RemonlinePanel } from '@/features/remonline/RemonlinePanel'

/**
 * Implements FR1, UX1, NFR-R1, NFR-A1 of sheets-app-redesign: shell with header, tabs and progress modal
 * (via OperationProvider). Laid out for a 300px sidebar without horizontal scroll (NFR-R1); text uses
 * foreground tokens with at least 4.5:1 contrast and every control is keyboard-reachable (NFR-A1).
 * Each tab reports errors through its own StatusBanner.
 */

function App() {
    const [activeTab, setActiveTab] = useState('ms')
    const [msFile, setMsFile] = useState<File | null>(null)

    function handleTabChange(value: string) {
        setActiveTab(value)
    }

    return (
        <TooltipProvider>
            <OperationProvider>
                <div>
                    <AppHeader />

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
                            <MoySkladPanel file={msFile} onFileChange={setMsFile} />
                        </AppTabsContent>

                        {/* ВКЛАДКА: РЕМОНЛАЙН */}
                        <AppTabsContent value="ro">
                            <RemonlinePanel />
                        </AppTabsContent>
                    </AppTabs>
                </div>
            </OperationProvider>
        </TooltipProvider>
    )
}

export default App

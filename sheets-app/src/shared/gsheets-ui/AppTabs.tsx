import type { ComponentProps } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { cn } from '@/shared/lib/tw'

interface AppTabsProps extends ComponentProps<typeof Tabs> {
    tabs: Array<{ value: string; label: string }>
}

/**
 * Implements FR1, UX1 of sheets-app-redesign: segmented tab switcher («Мой склад» / «Ремонлайн») followed by
 * a divider; `children` are the matching <AppTabsContent value="..."> panels (Body, padding 14).
 */
export function AppTabs({ tabs, className, children, ...props }: AppTabsProps) {
    return (
        <Tabs className={cn('gap-0', className)} {...props}>
            <div className="border-b px-3.5 pb-3.5">
                <TabsList variant="segment">
                    {tabs.map((tab) => (
                        <TabsTrigger key={tab.value} value={tab.value}>
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </div>
            <div data-testid="app-body" className="p-3.5">
                {children}
            </div>
        </Tabs>
    )
}

export { TabsContent as AppTabsContent }

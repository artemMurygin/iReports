import type { ComponentProps } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { cn } from '@/shared/lib/tw'

interface AppTabsProps extends ComponentProps<typeof Tabs> {
    tabs: Array<{ value: string; label: string }>
}

// Reproduces the reference sidebar's .tabs/.tab-btn switcher (frontend/GoogleSheetsInterface/
// index.html lines ~178-211, ~280-284): a flex row of equal-width tabs on a thin bottom border,
// the active tab picked out by a brand-green underline + dark-green label. Built on shadcn's
// Tabs; `children` should be the matching <AppTabsContent value="..."> panels.
export function AppTabs({ tabs, className, children, ...props }: AppTabsProps) {
    return (
        <Tabs className={cn('gap-0', className)} {...props}>
            <TabsList
                variant="line"
                className="mb-4 h-auto w-full gap-1 rounded-none border-b-[1.5px] border-[#eee] bg-transparent p-0"
            >
                {tabs.map((tab) => (
                    <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="flex-1 rounded-none border-x-0 border-t-0 border-b-[2.5px] border-transparent bg-transparent px-1 py-[9px] text-[13px] font-semibold text-[#888] shadow-none transition-colors duration-150 ease-in-out data-[state=active]:border-brand-green data-[state=active]:bg-transparent data-[state=active]:text-brand-green-dark data-[state=active]:shadow-none"
                    >
                        {tab.label}
                    </TabsTrigger>
                ))}
            </TabsList>
            {children}
        </Tabs>
    )
}

export { TabsContent as AppTabsContent }

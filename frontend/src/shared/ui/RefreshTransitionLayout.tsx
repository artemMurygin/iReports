import { type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SpinnerPageLg } from '@/shared/ui/SpinnerPageLg'

type Props = {
    isInitialLoad?: boolean
    isRefreshing?: boolean
    dataVersion?: number
    loadingLabel?: string
    className?: string
    children?: ReactNode
}

/**
 * Общая обёртка для страниц/виджетов с фоновым рефетчем: пока `isInitialLoad` — блокирует
 * весь блок `SpinnerPageLg`; после первой загрузки переключается на fade/blur-переход
 * (`AnimatePresence`/`motion.div`, ключ — `dataVersion`), который держит последние данные на
 * экране во время `isRefreshing` вместо того чтобы "схлопывать" их спиннером. Паттерн был
 * продублирован в `SalesPlanPage`, `ServicesReport/ui/Layout` и `FunnelReport/ui/Layout` —
 * вынесен сюда, чтобы дальнейшие правки анимации не расходились по трём копиям.
 */
export function RefreshTransitionLayout({
    isInitialLoad = false,
    isRefreshing = false,
    dataVersion = 0,
    loadingLabel = 'Загрузка данных...',
    className = 'flex flex-col gap-4',
    children,
}: Props) {
    if (isInitialLoad) {
        return <SpinnerPageLg label={loadingLabel} />
    }

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={dataVersion}
                initial={{ opacity: 0, y: 4 }}
                animate={{
                    opacity: 1,
                    y: 0,
                    filter: isRefreshing ? 'blur(1.5px)' : 'blur(0px)',
                    transition: { duration: 0.4, ease: 'easeOut' },
                }}
                exit={{ opacity: 0, y: 6, transition: { duration: 0.18, ease: 'easeIn' } }}
                style={{ pointerEvents: isRefreshing ? 'none' : 'auto' }}
                className={className}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    )
}

import { type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ErrorLayout } from '@/shared/ui/ErrorLayout.tsx'
import { SpinnerPageLg } from '@/shared/ui/SpinnerPageLg'

type Props = {
    isInitialLoad?: boolean
    isRefreshing?: boolean
    dataVersion?: number
    header?: ReactNode
    error: string | null
    body?: ReactNode
}

export function Layout({ isInitialLoad, isRefreshing = false, dataVersion = 0, header, error, body }: Props) {
    return (
        <main className="flex flex-col flex-1">
            {header}
            {isInitialLoad ? (
                <SpinnerPageLg label="Загрузка данных..." />
            ) : (
                <AnimatePresence mode="wait">
                    <motion.div
                        key={dataVersion}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{
                            opacity: 1,
                            y: 0,
                            filter: isRefreshing ? 'blur(1.5px)' : 'blur(1 px)',
                            transition: { duration: 0.5, ease: 'easeOut' },
                        }}
                        exit={{
                            opacity: 0,
                            y: 8,
                            transition: { duration: 0.22, ease: 'easeIn' },
                        }}
                        style={{
                            pointerEvents: isRefreshing ? 'none' : 'auto',
                        }}
                        className="flex flex-col gap-6 p-6"
                    >
                        {error && <ErrorLayout error={error} />}
                        {body}
                    </motion.div>
                </AnimatePresence>
            )}
        </main>
    )
}

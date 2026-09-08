import type { LeadsEntry } from '@/features/DealsOverTimeCharts/model/types'
import { useMiniCard } from '../../model/MiniCard/useMiniCard.ts'
import { Layout } from './Layout'
import { Header } from './Header'
import { Body } from './Body'
import { Footer } from './Footer'

interface MiniCardProps {
    source: string
    data: LeadsEntry[]
    globalMax: number
}

export function MiniCard({ source, data, globalMax }: MiniCardProps) {
    const { pts, lastVal, pct, lineColor } = useMiniCard({ source, data })

    return (
        <Layout>
            <Header source={source} />
            <Body lastVal={lastVal} pct={pct} lineColor={lineColor} />
            <Footer pts={pts} globalMax={globalMax} lineColor={lineColor} />
        </Layout>
    )
}

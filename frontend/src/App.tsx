import { useState, useMemo, useEffect } from 'react'
import { startOfMonth, endOfMonth } from "date-fns"
import { Navbar } from "@/components/dashboard/Navbar"
import { FilterBar } from "@/components/dashboard/FilterBar"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { DealsTable } from "@/components/dashboard/DealsTable"
import { type DashboardFilters } from "@/types/filters"
import { api } from '../shared/axios.instance.ts';
import { LeadsOverTimeLinearChart } from '@/components/dashboard/LeadsOverTimeLinearChart.tsx';
import { LeadsBySourceChart } from '@/components/dashboard/LeadsBySourceChart.tsx';
import { DealsByStage } from '@/components/dashboard/DealsByStage.tsx';

const today = new Date()

const defaultFilters: DashboardFilters = {
    dateRange: { from: startOfMonth(today), to: new Date() },
    managers: [],
    sources: [],
    deviceTypes: [],
    stages: []
}

export function App() {
    const [filters, setFilters] = useState<DashboardFilters>(defaultFilters)
    const [deals, setDeals] = useState([])
    const [KPI, setKPI] = useState({})
    const [employees, setEmployees] = useState([])
    const [sources, setSources] = useState([])
    const [deviceTypes, setDeviceTypes] = useState([])
    const [stages, setStages] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)


    useEffect(() => {
        Promise.all([
            api.get("/deals/stages"),
            api.get("/deals/managers"),
            api.get("/deals/sources"),
            api.get("/deals/models"),
        ]).then(([stagesRes, managersRes, sourcesRes, modelsRes]) => {
            setStages(stagesRes.data)
            setEmployees(managersRes.data)
            setSources(sourcesRes.data)
            setDeviceTypes(modelsRes.data)
        }).catch(error => setError(error))
    }, []);

    useEffect(() => {
        const { dateRange, stages, managers, sources, deviceTypes } = filters
        setLoading(true)
        api.get("/reports/service-funnel", {
            params:{
                momentFrom: dateRange.from,
                momentTo: dateRange.to,
                stageIds: stages,
                managerIds: managers,
                sourceIds: sources,
                modelIds: deviceTypes
            }})
           .then(response => {
                const { KPI, deals } = response.data
                setDeals(deals)
                setKPI(KPI)
           })
           .catch(error => setError(error))
           .finally(() => setLoading(false))
    }, [filters])

    return (
        <>
            <div className="flex flex-col min-h-screen bg-gray-50" style={{ fontFamily: "Inter, sans-serif" }}>
                <div className="sticky top-0 z-10">
                    <Navbar />
                    <FilterBar
                        filters={filters}
                        employees={employees}
                        sources={sources}
                        deviceTypes={deviceTypes}
                        stages={stages}
                        loading={loading}
                        onChange={setFilters}
                        onReset={() => setFilters(defaultFilters)}
                    />
                </div>
                {error &&
                    (<div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        Ошибка загрузки данных: {error}
                    </div>)
                }
                <main className="flex flex-col gap-6 p-6 flex-1">
                    <div className={`flex flex-col gap-6 transition-opacity duration-150 ${loading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                        <div className="flex gap-2">
                            <KpiCard label="Всего" value={`${KPI.nonTargetDeals + KPI.targetedLeads ?? ''}`} />
                            <KpiCard label="Нецелевые" value={KPI.nonTargetDeals ?? ''} />
                            <KpiCard label="Целевые" value={KPI.targetedLeads ?? ''} />
                            <KpiCard label="В работе" value={KPI.inWork ?? ''} />
                            <KpiCard label="Записаны" value={KPI.waitingInService ?? ''} />
                            <KpiCard label="В ремонте" value={KPI.inService ?? ''} />
                            <KpiCard label="Успешные" value={KPI.won ?? ''} />
                            <KpiCard label="Отказы" value={KPI.lose ?? ''} />
                            <KpiCard label="Выручка" value={KPI.revenue?.toLocaleString('Ru-ru') ?? ''} />
                            <KpiCard label="Конверсия" value={`${KPI.conversionRate ?? ''}%`} />
                        </div>
                        <LeadsOverTimeLinearChart deals={deals}/>
                        <div className="flex gap-6 h-[400px]">
                            <LeadsBySourceChart deals={deals} />
                            <DealsByStage deals={deals} />
                        </div>
                        <DealsTable deals={deals}/>
                    </div>
                </main>
            </div>
        </>
    )
}

export default App


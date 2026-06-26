import { useEffect, useState } from 'react';
import type { DashboardFilters } from '@/pages/FunnelReportService/types.ts';
import { api } from '@/shared/axios.instance.ts';
import type { ApiStageExtended } from '@/types/deal.ts';
import { startOfMonth } from 'date-fns';

const today = new Date()
const defaultFilters: DashboardFilters = {
    dateRange: { from: startOfMonth(today), to: new Date() },
    managers: [],
    sources: [],
    deviceTypes: [],
    stages: [],
    stageGroups: [],
}

export function useFilters(){
    const [filters, setFilters] = useState<DashboardFilters>(defaultFilters)
    const [employees, setEmployees] = useState([])
    const [sources, setSources] = useState([])
    const [deviceTypes, setDeviceTypes] = useState([])
    const [stages, setStages] = useState<ApiStageExtended[]>([])
    const [stageGroups, setStageGroups] = useState<{ id: string; name: string }[]>([])
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        Promise.all([
            api.get("/deals/stages"),
            api.get("/deals/managers"),
            api.get("/deals/sources"),
            api.get("/deals/models"),
            api.get("/deals/stage-groups"),
        ]).then(([stagesRes, managersRes, sourcesRes, modelsRes, stageGroupsRes]) => {
            setStages(stagesRes.data)
            setEmployees(managersRes.data)
            setSources(sourcesRes.data)
            setDeviceTypes(modelsRes.data)
            setStageGroups(stageGroupsRes.data)
        }).catch(error => setError(error))
    }, []);

    return {
        filters,
        employees,
        sources,
        deviceTypes,
        stages,
        stageGroups,
        setFilters,
        setError,
        error,
        defaultFilters
    }
}



import { type DateRange } from "react-day-picker"

export interface DashboardFilters {
    dateRange: DateRange | undefined
    managers: string[]
    sources: string[]
    deviceTypes: string[]
    stages: string[]
}
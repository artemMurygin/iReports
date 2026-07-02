import { api } from '@/shared/axios.instance'
import type {
    CategoryNode,
    Department,
    Direction,
    Employee,
    Goal,
    PlanFactRow,
    Reward,
    SalaryAdjustment,
    SalaryReportData,
    SalaryRule,
    Scope,
    WorkShift,
} from './types'

export const salaryApi = {
    getEmployees: () => api.get<Employee[]>('/salary/employees'),
    updateEmployee: (id: number, data: { roappOnlineName: string | null }) =>
        api.patch<Employee>(`/salary/employees/${id}`, data),
    getDepartments: () => api.get<Department[]>('/salary/departments'),
    getCategories: (direction: Direction) =>
        api.get<CategoryNode[]>('/salary/categories', { params: { direction } }),

    getRules: (params: { employeeId?: number; period?: string } = {}) =>
        api.get<SalaryRule[]>('/salary-rules', { params }),
    createRule: (data: Partial<SalaryRule> & { assignments: { employeeId?: number; departmentId?: number }[] }) =>
        api.post<SalaryRule>('/salary-rules', data),
    updateRule: (id: number, data: Partial<SalaryRule>) =>
        api.patch<SalaryRule>(`/salary-rules/${id}`, data),
    archiveRule: (id: number) => api.post<SalaryRule>(`/salary-rules/${id}/archive`),
    deleteRule: (id: number) => api.delete(`/salary-rules/${id}`),

    createGoal: (data: Partial<Goal>) => api.post<Goal>('/goals', data),
    updateGoal: (id: number, data: Partial<Goal>) => api.patch<Goal>(`/goals/${id}`, data),
    deleteGoal: (id: number) => api.delete(`/goals/${id}`),

    createReward: (data: Partial<Reward>) => api.post<Reward>('/rewards', data),
    updateReward: (id: number, data: Partial<Reward>) => api.patch<Reward>(`/rewards/${id}`, data),

    getPlanFact: (params: { period: string; direction?: Direction; scope: Scope }) =>
        api.get<PlanFactRow[]>('/plan-fact', { params }),
    bulkCreatePlanTargets: (items: Array<Partial<PlanFactRow>>) =>
        api.post('/plan-targets', { items }),
    updatePlanTarget: (id: number, data: Partial<PlanFactRow>) =>
        api.patch(`/plan-targets/${id}`, data),
    deletePlanTarget: (id: number) =>
        api.delete(`/plan-targets/${id}`),

    getWorkSchedule: (employeeId: number, period: string) =>
        api.get<WorkShift[]>('/work-schedule', { params: { employeeId, period } }),
    bulkUpsertShifts: (shifts: Array<Partial<WorkShift>>) =>
        api.post('/work-schedule/bulk', { shifts }),
    updateShift: (id: number, data: Partial<WorkShift>) =>
        api.patch(`/work-shifts/${id}`, data),

    getAdjustments: (employeeId: number, period: string) =>
        api.get<SalaryAdjustment[]>('/salary-adjustments', { params: { employeeId, period } }),
    createAdjustment: (data: {
        employeeId: number
        period: string
        accrualType: 'PENALTY' | 'ADJUSTMENT'
        amount: number
        reason: string
        createdById: number
    }) => api.post<SalaryAdjustment>('/salary-adjustments', data),

    getSalaryReport: (employeeId: number, period: string) =>
        api.get<SalaryReportData>('/salaryReport', { params: { employeeId, period } }),
    closeSalaryReport: (employeeId: number, period: string) =>
        api.post<SalaryReportData>('/salaryReport/close', { employeeId, period }),
}

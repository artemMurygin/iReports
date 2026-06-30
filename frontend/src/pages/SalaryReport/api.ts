import { api } from '@/shared/axios.instance'
import type {
    Direction,
    MotivationRule,
    MotivationTarget,
    CoefficientScale,
    Plan,
    Fact,
    MotivationRow,
} from './types'

export const salaryApi = {
    // Seed
    seed: () => api.post('/salary-report/seed'),

    // Directions
    getDirections: () => api.get<Direction[]>('/salary-report/directions'),

    // Targets
    getTargets: (directionId?: number) =>
        api.get<MotivationTarget[]>('/salary-report/targets', {
            params: directionId ? { directionId } : {},
        }),
    createTarget: (data: { directionId: number; metric: 'revenue' | 'margin'; moySkladFolderId?: string; roappServiceCategoryId?: number; roappProductCategoryId?: number }) =>
        api.post<MotivationTarget>('/salary-report/targets', data),
    ensureTarget: (data: { directionId: number; metric: 'revenue' | 'margin'; moySkladFolderId?: string; roappServiceCategoryId?: number; roappProductCategoryId?: number }) =>
        api.post<MotivationTarget>('/salary-report/targets/ensure', data),
    deleteTarget: (id: number) => api.delete(`/salary-report/targets/${id}`),

    // Category lookups
    getMoySkladFolders: () =>
        api.get<{ id: string; name: string; pathName: string; parentId: string | null }[]>('/salary-report/categories/moy-sklad-folders'),
    getRoappServiceCategories: () =>
        api.get<{ id: number; name: string; parentId: number | null; depth: number }[]>('/salary-report/categories/roapp-service'),
    getRoappProductCategories: () =>
        api.get<{ id: number; name: string; parentId: number | null }[]>('/salary-report/categories/roapp-products'),

    // Scales
    getScales: () => api.get<CoefficientScale[]>('/salary-report/scales'),
    createScale: (name: string) => api.post<CoefficientScale>('/salary-report/scales', { name }),
    deleteScale: (id: number) => api.delete(`/salary-report/scales/${id}`),
    createPoint: (scaleId: number, data: { fulfillmentPct: number; coefficient: number }) =>
        api.post(`/salary-report/scales/${scaleId}/points`, data),
    updatePoint: (id: number, data: { fulfillmentPct?: number; coefficient?: number }) =>
        api.patch(`/salary-report/points/${id}`, data),
    deletePoint: (id: number) => api.delete(`/salary-report/points/${id}`),

    // Rules
    getRules: (directionId?: number) =>
        api.get<MotivationRule[]>('/salary-report/rules', {
            params: directionId ? { directionId } : {},
        }),
    createRule: (data: {
        name: string
        directionId: number
        scaleId: number
        payoutBase: 'revenue' | 'margin'
        effectiveFrom?: string
    }) => api.post<MotivationRule>('/salary-report/rules', data),
    updateRule: (id: number, data: Partial<{ name: string; scaleId: number; payoutBase: 'revenue' | 'margin' }>) =>
        api.patch<MotivationRule>(`/salary-report/rules/${id}`, data),
    deleteRule: (id: number) => api.delete(`/salary-report/rules/${id}`),

    // Rule items
    createRuleItem: (ruleId: number, data: { targetId: number; basePercent: number }) =>
        api.post(`/salary-report/rules/${ruleId}/items`, data),
    updateRuleItem: (id: number, basePercent: number) =>
        api.patch(`/salary-report/rule-items/${id}`, { basePercent }),
    deleteRuleItem: (id: number) => api.delete(`/salary-report/rule-items/${id}`),

    // Plan
    getPlans: (period?: string, directionId?: number) =>
        api.get<Plan[]>('/salary-report/plans', { params: { period, directionId } }),
    createPlan: (data: { targetId: number; period: string; value: number }) =>
        api.post<Plan>('/salary-report/plans', data),
    updatePlan: (id: number, value: number) => api.patch<Plan>(`/salary-report/plans/${id}`, { value }),
    deletePlan: (id: number) => api.delete(`/salary-report/plans/${id}`),

    // Fact
    getFacts: (period?: string, directionId?: number) =>
        api.get<Fact[]>('/salary-report/facts', { params: { period, directionId } }),
    createFact: (data: { targetId: number; period: string; value: number; source: string }) =>
        api.post<Fact>('/salary-report/facts', data),
    updateFact: (id: number, data: { value?: number; source?: string }) =>
        api.patch<Fact>(`/salary-report/facts/${id}`, data),
    deleteFact: (id: number) => api.delete(`/salary-report/facts/${id}`),

    // Motivation calculation
    getMotivation: (period: string, ruleId?: number) =>
        api.get<MotivationRow[]>('/salary-report/motivation', { params: { period, ruleId } }),
}

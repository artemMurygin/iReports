import { queryOptions } from '@tanstack/react-query'
import { salaryApi } from './api'
import type { Direction, Scope } from './types'

export const employeesQuery = queryOptions({
    queryKey: ['salary', 'employees'],
    queryFn: () => salaryApi.getEmployees().then((r) => r.data),
    staleTime: 5 * 60_000,
})

export const departmentsQuery = queryOptions({
    queryKey: ['salary', 'departments'],
    queryFn: () => salaryApi.getDepartments().then((r) => r.data),
    staleTime: 5 * 60_000,
})

export const rulesQuery = queryOptions({
    queryKey: ['salary', 'rules'],
    queryFn: () => salaryApi.getRules().then((r) => r.data),
})

export const categoriesQuery = (direction: Direction) =>
    queryOptions({
        queryKey: ['salary', 'categories', direction],
        queryFn: () => salaryApi.getCategories(direction).then((r) => r.data),
        staleTime: 5 * 60_000,
    })

export const planFactQuery = (params: { period: string; direction?: Direction; scope: Scope }) =>
    queryOptions({
        queryKey: ['salary', 'plan-fact', params],
        queryFn: () => salaryApi.getPlanFact(params).then((r) => r.data),
    })

export const workScheduleQuery = (employeeId: number, period: string) =>
    queryOptions({
        queryKey: ['salary', 'work-schedule', employeeId, period],
        queryFn: () => salaryApi.getWorkSchedule(employeeId, period).then((r) => r.data),
    })

export const salaryReportQuery = (employeeId: number, period: string) =>
    queryOptions({
        queryKey: ['salary', 'report', employeeId, period],
        queryFn: () => salaryApi.getSalaryReport(employeeId, period).then((r) => r.data),
    })

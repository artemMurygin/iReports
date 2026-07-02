import { useState } from 'react'
import { SalaryView } from './components/SalaryView'
import { PlanFactView } from './components/PlanFactView'
import { WorkScheduleView } from './components/WorkScheduleView'
import { RulesView } from './components/RulesView'

const TABS = [
    { key: 'salary', label: 'Зарплата' },
    { key: 'plan-fact', label: 'План/Факт' },
    { key: 'schedule', label: 'График работы' },
    { key: 'rules', label: 'Правила' },
] as const

type TabKey = (typeof TABS)[number]['key']

export function SalaryReport() {
    const [tab, setTab] = useState<TabKey>('salary')

    return (
        <main className="flex flex-col flex-1">
            <div className="sticky top-16 z-10 flex items-center gap-1 px-6 bg-white border-b border-gray-200 shrink-0">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                            tab === t.key
                                ? 'border-emerald-500 text-gray-900'
                                : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="flex flex-col gap-6 p-6">
                {tab === 'salary' && <SalaryView />}
                {tab === 'plan-fact' && <PlanFactView />}
                {tab === 'schedule' && <WorkScheduleView />}
                {tab === 'rules' && <RulesView />}
            </div>
        </main>
    )
}

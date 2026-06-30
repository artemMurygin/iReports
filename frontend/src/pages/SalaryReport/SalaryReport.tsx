import { useState } from 'react'
import { toast } from 'sonner'
import { DatabaseZap } from 'lucide-react'
import { MotivationView } from './components/MotivationView'
import { PlanFactView } from './components/PlanFactView'
import { SettingsView } from './components/SettingsView'
import { salaryApi } from './api'

type Tab = 'motivation' | 'plan-fact' | 'settings'

const TABS: { key: Tab; label: string }[] = [
    { key: 'motivation', label: 'Мотивация' },
    { key: 'plan-fact', label: 'План / Факт' },
    { key: 'settings', label: 'Настройки' },
]

export function SalaryReport() {
    const [tab, setTab] = useState<Tab>('motivation')
    const [seeding, setSeeding] = useState(false)

    async function handleSeed() {
        setSeeding(true)
        try {
            await salaryApi.seed()
            toast.success('Тестовые данные загружены — обновите страницу')
        } catch {
            toast.error('Ошибка загрузки тестовых данных')
        } finally {
            setSeeding(false)
        }
    }

    return (
        <main className="flex flex-col flex-1">
            {/* ── Панель вкладок ─────────────────────────────────────────────────── */}
            <div className="sticky top-16 z-10 flex items-center gap-6 px-6 py-0 bg-white border-b border-gray-200 shrink-0">
                <div className="flex items-center gap-0">
                    {TABS.map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            className={`px-4 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                                tab === key
                                    ? 'border-gray-900 text-gray-900'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="ml-auto">
                    <button
                        onClick={handleSeed}
                        disabled={seeding}
                        title="Заполнить тестовыми данными"
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                        <DatabaseZap className="size-3.5" />
                        {seeding ? 'Загрузка...' : 'Тест. данные'}
                    </button>
                </div>
            </div>

            {/* ── Контент вкладки ────────────────────────────────────────────────── */}
            <div className="flex-1 p-6 max-w-7xl w-full mx-auto">
                {tab === 'motivation' && <MotivationView />}
                {tab === 'plan-fact' && <PlanFactView />}
                {tab === 'settings' && <SettingsView />}
            </div>
        </main>
    )
}

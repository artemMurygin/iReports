import { BarChart3 } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const NAV = [
    { label: 'Воронка продаж', to: '/', disabled: false },
    { label: 'Аналитика услуг', to: '/services', disabled: false },
    { label: 'Отчёт по зарплатам', to: '/salaries', disabled: false },
]

export function Header() {
    return (
        <header className="sticky top-0 z-10 flex items-center h-16 px-6 bg-white border-b border-gray-200 shrink-0 gap-8">
            <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center justify-center w-8 h-8 bg-[#38d97b] rounded-lg">
                    <BarChart3 className="w-[18px] h-[18px] text-white" />
                </div>
                <span
                    className="text-lg font-semibold text-gray-900"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                >
                    iRepair
                </span>
            </div>
            <nav className="flex items-center gap-1">
                {NAV.map(({
 label, to, disabled 
}) =>
                    disabled ? (
                        <span
                            key={to}
                            className="px-3 py-1.5 text-sm text-gray-300 cursor-not-allowed select-none"
                            style={{ fontFamily: 'Inter, sans-serif' }}
                        >
                            {label}
                        </span>
                    ) : (
                        <NavLink
                            key={to}
                            to={to}
                            className={({ isActive }) =>
                                `px-3 py-1.5 text-sm rounded-md transition-colors ${isActive ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`
                            }
                            style={{ fontFamily: 'Inter, sans-serif' }}
                        >
                            {label}
                        </NavLink>
                    ),
                )}
            </nav>
        </header>
    )
}

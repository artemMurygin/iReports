import { ChevronRight } from 'lucide-react'
import type { BreadcrumbItem } from '../types'

interface Props {
    breadcrumbs: BreadcrumbItem[]
    onChange: (id: string | null) => void
}

export function CategoryBreadcrumbs({ breadcrumbs, onChange }: Props) {
    if (breadcrumbs.length <= 1) return null

    return (
        <div className="sticky top-[124px] z-10 flex items-center gap-1 px-6 py-4 text-sm border-y border-gray-200 bg-white shadow-sm">
            {breadcrumbs.map((crumb, i) => {
                const isLast = i === breadcrumbs.length - 1
                return (
                    <div key={crumb.id ?? 'root'} className="flex items-center gap-1">
                        {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />}
                        {isLast ? (
                            <span className="font-medium text-gray-900 truncate max-w-[200px]">
                                {crumb.name}
                            </span>
                        ) : (
                            <button
                                onClick={() => onChange(crumb.id)}
                                className="text-gray-500 hover:text-gray-800 transition-colors truncate max-w-[200px]"
                            >
                                {crumb.name}
                            </button>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

import { ChevronsUpDown } from 'lucide-react'

export function TableHeader() {
    return (
        <div className="flex items-center h-11 bg-gray-50 border-b border-gray-200">
            <div className="w-[130px] px-3 text-xs font-medium text-gray-500">Создано</div>
            <div className="flex items-center gap-1 flex-1 px-3 text-xs font-medium text-gray-500">
                Название сделки <ChevronsUpDown className="w-3.5 h-3.5" />
            </div>
            <div className="w-[180px] px-3 text-xs font-medium text-gray-500">Менеджер</div>
            <div className="w-[200px] px-3 text-xs font-medium text-gray-500">Этап</div>
            <div className="w-[200px] px-3 text-xs font-medium text-gray-500">Источник</div>
            <div className="w-[200px] px-3 text-xs font-medium text-gray-500">Точка контакта</div>
            <div className="w-[140px] px-3 text-xs font-medium text-gray-500 text-right">Сумма</div>
        </div>
    )
}
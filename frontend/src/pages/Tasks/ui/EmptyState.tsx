import { ListChecks, Plus } from 'lucide-react'

import { Button } from '@/shared/ui-kit/atoms/Button'

export type EmptyStateProps = {
    onCreateTask: () => void
    className?: string
}

/**
 * Pencil: `cHCoj` (Задачи · Список, Десктоп, пусто), узел `BojQy` — icon `list-checks`,
 * «Нет задач с такими фильтрами», hint, primary CTA «Новая задача». Same icon as the topnav's
 * «Задачи» item (`t7zmq`) and the section itself, per the mockup.
 */
function EmptyState({ onCreateTask, className }: EmptyStateProps) {
    return (
        <div data-slot="tasks-empty-state" className={className}>
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 rounded-xl border border-hairline bg-surface px-6 py-16 text-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-canvas">
                    <ListChecks className="size-7 text-ink-faint" />
                </div>

                <div className="flex flex-col items-center gap-2">
                    <h2 className="font-display text-lg font-bold tracking-[-0.2px] text-ink">
                        Нет задач с такими фильтрами
                    </h2>
                    <p className="max-w-[420px] font-ui text-[13px] leading-[1.5] text-ink-muted">
                        Попробуйте изменить статус или направление, либо создайте новую задачу
                    </p>
                </div>

                <Button type="button" onClick={onCreateTask}>
                    <Plus />
                    Новая задача
                </Button>
            </div>
        </div>
    )
}

export { EmptyState }

import { Dialog as DialogPrimitive } from 'radix-ui'

import { TaskStatusControl } from '@/features/TaskStatusControl'
import { cn } from '@/shared/lib/tw'

export type TaskDrawerProps = {
    taskId: string | null
    onClose: () => void
}

/**
 * `TaskStatusControl`'s own doc comment (`TaskStatusCard.tsx`): "`pages/Tasks`/`SalaryRuleDetail`
 * сами решают, оборачивать ли эту карточку в Drawer или BottomSheet" — this is that wrapper for
 * `/tasks`, page-local (not a `shared/ui-kit` organism, `SalaryRuleDetail`'s own wrapper for its
 * wizard step 2 readonly task card, group 14 tasks.md, is a separate concern this task doesn't
 * touch). Right-side drawer on desktop (Pencil `kf1uq`/`QpFcx`/`yZE5X`, 460px), bottom sheet on
 * mobile (`cmZjM`) — one `radix-ui` `Dialog.Content` whose position/sizing flips at `md:` instead
 * of two components, since `TaskStatusCard` itself already renders identical content both ways.
 *
 * `TaskStatusCard` already renders its own title + close button (`X`) inside the panel, so this
 * wrapper adds only a visually-hidden `Dialog.Title` for the accessible name radix requires, not a
 * second visible header.
 */
function TaskDrawer({ taskId, onClose }: TaskDrawerProps) {
    return (
        <DialogPrimitive.Root open={taskId !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay
                    data-slot="task-drawer-overlay"
                    className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
                />
                <DialogPrimitive.Content
                    data-slot="task-drawer-content"
                    className={cn(
                        'fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col overflow-y-auto rounded-t-2xl border-t border-hairline bg-surface shadow-2xl outline-none',
                        'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom',
                        'md:inset-y-0 md:right-0 md:left-auto md:bottom-auto md:h-full md:max-h-none md:w-[460px] md:rounded-none md:rounded-l-2xl md:border-t-0 md:border-l',
                        'md:data-[state=open]:slide-in-from-right md:data-[state=closed]:slide-out-to-right',
                    )}
                >
                    <DialogPrimitive.Title className="sr-only">Карточка задачи</DialogPrimitive.Title>
                    {taskId && <TaskStatusControl taskId={taskId} onClose={onClose} />}
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    )
}

export { TaskDrawer }

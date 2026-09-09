import { Plus } from 'lucide-react'

import { TaskDetailsPanel } from '@/features/TaskStatusControl'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { PageHeader } from '@/shared/ui-kit/organisms/PageHeader.tsx'

import { useTasksPage } from '../model/useTasksPage.ts'
import { CreateTaskModal } from './CreateTaskModal.tsx'
import { FilterBar } from './FilterBar.tsx'
import { Layout } from './Layout.tsx'
import { TasksBody } from './TasksBody.tsx'

/**
 * replace-bitrix-task-integration, tasks.md группа 13. Pencil: `iZrrX` (десктоп, список),
 * `cHCoj` (десктоп, пусто), `JlkUN` (мобильный) — маршрут `/tasks` (`app/router.tsx`,
 * `app/navigation.tsx`'s `TASKS_STANDALONE_ITEM`). Список всех задач компании независимо от
 * направления и от того, ссылается ли на них какое-либо зарплатное правило (specs/tasks/spec.md
 * «Задача видна в интерфейсе на любой стадии жизненного цикла») — поверх уже готовых
 * `features/CreateTask` (группа 11) и `features/TaskStatusControl` (группа 12).
 *
 * Чистый медиатор (frontend/CLAUDE.md): весь стейт — в `useTasksPage`, без mediator-папки
 * (architecture.md: «`pages/Tasks` по-прежнему обходится без mediator» — один stateful-виджет).
 * Условный рендер список/пусто вынесен в `TasksBody`.
 */
export function TasksPage() {
    const {
        tasks,
        isInitialLoad,
        isRefreshing,
        error,
        statusFilter,
        setStatusFilter,
        directionFilter,
        setDirectionFilter,
        search,
        setSearch,
        hasTasks,
        selectedTaskId,
        openTaskDetail,
        closeTaskDetail,
        isCreateOpen,
        openCreateModal,
        closeCreateModal,
        onTaskCreated,
    } = useTasksPage()

    const header = (
        <>
            <PageHeader
                title="Задачи"
                subtitle="Все задачи компании — независимо от направления и от зарплатных правил, которые на них ссылаются"
                actions={
                    <Button type="button" onClick={openCreateModal}>
                        <Plus />
                        Новая задача
                    </Button>
                }
            />
            <FilterBar
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                directionFilter={directionFilter}
                onDirectionFilterChange={setDirectionFilter}
                search={search}
                onSearchChange={setSearch}
            />
        </>
    )

    const body = (
        <TasksBody tasks={tasks} hasTasks={hasTasks} onSelect={openTaskDetail} onCreateTask={openCreateModal} />
    )

    return (
        <>
            <Layout
                isInitialLoad={isInitialLoad}
                isRefreshing={isRefreshing}
                error={error}
                header={header}
                body={body}
            />

            <CreateTaskModal
                open={isCreateOpen}
                onOpenChange={(open) => (open ? openCreateModal() : closeCreateModal())}
                onCreated={onTaskCreated}
            />

            <TaskDetailsPanel taskId={selectedTaskId} onClose={closeTaskDetail} />
        </>
    )
}

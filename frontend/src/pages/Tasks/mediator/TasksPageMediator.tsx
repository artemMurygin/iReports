import { Plus } from 'lucide-react'

import { TaskDetailsPanel } from '@/features/TaskStatusControl'
import { SalaryRuleDetailsPanel } from '@/features/SalaryRuleDetailsPanel'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { PageHeader } from '@/shared/ui-kit/organisms/PageHeader.tsx'

import { useTasksPage } from '../model/useTasksPage.ts'
import { useSalaryRulePanel } from '../model/useSalaryRulePanel.ts'
import { CreateTaskModal } from '../ui/CreateTaskModal.tsx'
import { FilterBar } from '../ui/FilterBar.tsx'
import { Layout } from '../ui/Layout.tsx'
import { TasksBody } from '../ui/TasksBody.tsx'

/**
 * replace-bitrix-task-integration, tasks.md группа 13. Pencil: `iZrrX` (десктоп, список),
 * `cHCoj` (десктоп, пусто), `JlkUN` (мобильный) — маршрут `/tasks` (`app/router.tsx`,
 * `app/navigation.tsx`'s `TASKS_STANDALONE_ITEM`). Список всех задач компании независимо от
 * направления и от того, ссылается ли на них какое-либо зарплатное правило (specs/tasks/spec.md
 * «Задача видна в интерфейсе на любой стадии жизненного цикла») — поверх уже готовых
 * `features/CreateTask` (группа 11) и `features/TaskStatusControl` (группа 12).
 *
 * add-task-salary-rule-links-comments, tasks.md группа 30 — раньше здесь был единственный
 * stateful-виджет (`useTasksPage()`, комментарий в прежней `ui/TasksPage.tsx` явно обосновывал
 * отсутствие `mediator/`). Клик по связанному зарплатному правилу на карточке задачи
 * (`TaskDetailsPanel`'s `onOpenSalaryRule`) открывает вторую независимую боковую панель
 * (`features/SalaryRuleDetailsPanel`) — двух stateful-виджетов достаточно, чтобы вынести саму
 * страницу в mediator-компонент (frontend/CLAUDE.md, «Mediator-компонент для страниц с несколькими
 * виджетами»): `useTasksPage()` (список/фильтры/карточка задачи) и `useSalaryRulePanel()`
 * (какое правило открыто) не знают друг о друге — их единственная связь — колбэк `openRule`,
 * прокинутый в `TaskDetailsPanel` как `onOpenSalaryRule`, тем же способом, каким
 * `features/SalaryRuleForm/model/useTaskLinkPanels.ts` уже оркеструет две независимые панели через
 * `taskId` на других страницах (`pages/SalaryRuleDetail`, `pages/SalaryRules`).
 *
 * `SalaryRuleDetailsPanel` получает готовый `openRuleRef` целиком (`{ruleId, direction, open}`,
 * см. `useSalaryRulePanel`'s JSDoc) — сам mediator не решает, что показывать (никакого `&&`/
 * тернарника здесь нет, ветвление список/пусто уже внутри `TasksBody`, показ/скрытие панелей —
 * внутри самих `TaskDetailsPanel`/`SalaryRuleDetailsPanel` по их собственным `taskId`/`open`).
 */
export function TasksPageMediator() {
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

    const { openRuleRef, openRule, closeRule } = useSalaryRulePanel()

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

            <TaskDetailsPanel taskId={selectedTaskId} onClose={closeTaskDetail} onOpenSalaryRule={openRule} />

            <SalaryRuleDetailsPanel {...openRuleRef} onClose={closeRule} />
        </>
    )
}

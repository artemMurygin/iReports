import { useEffect, useRef } from 'react'

export type UseInfiniteScrollTriggerOptions = {
    /** Есть ли ещё что подгружать — пока `false`, наблюдатель не создаётся вовсе. */
    hasMore: boolean
    /** Загрузка уже идёт — `onLoadMore` не вызывается повторно, пока предыдущая не завершится. */
    isLoading: boolean
    onLoadMore: () => void
    /** Насколько раньше пересечения вьюпорта срабатывает колбэк (см. `IntersectionObserver`'s
     * `rootMargin`) — по умолчанию с запасом в 200px, чтобы подгрузка успевала закончиться до
     * того, как пользователь физически долистает до конца списка. */
    rootMargin?: string
}

/**
 * Sentinel-хук для бесконечной подгрузки (docs/employee-settlements-page-redesign, Фаза 8) —
 * первый прецедент `IntersectionObserver` в проекте (до этой фазы бесконечная прокрутка нигде не
 * использовалась), поэтому вынесен в `shared/hooks` как переиспользуемая инфраструктура без
 * бизнес-логики (frontend/CLAUDE.md: `shared` не должен знать про баланс/ленту/сотрудников —
 * знает только про «элемент показался — вызови колбэк»), а не оставлен внутри
 * `pages/EmployeeBalance` ради единственного текущего потребителя.
 *
 * Использование: подставить возвращаемый ref на пустой sentinel-элемент в конце списка —
 * `<div ref={sentinelRef} />`; наблюдатель сам создаётся/пересоздаётся при смене
 * `hasMore`/`isLoading`/`rootMargin` и отключается при размонтировании. `onLoadMore` читается
 * через ref (не как зависимость эффекта) — иначе новый `onLoadMore` на каждый рендер страницы
 * пересоздавал бы `IntersectionObserver` без необходимости.
 *
 * `typeof IntersectionObserver === 'undefined'` — защита для сред без него (jsdom по умолчанию,
 * см. `useInfiniteScrollTrigger.spec.ts`): хук просто не подгружает следующую страницу
 * автоматически вместо падения с `ReferenceError`.
 */
export function useInfiniteScrollTrigger<T extends Element>({
    hasMore,
    isLoading,
    onLoadMore,
    rootMargin = '200px',
}: UseInfiniteScrollTriggerOptions) {
    const sentinelRef = useRef<T | null>(null)
    const onLoadMoreRef = useRef(onLoadMore)
    const isLoadingRef = useRef(isLoading)

    // Ref-присвоение — эффект, а не прямое присвоение во время рендера (запрещено линтером
    // `react-hooks/refs`, «Cannot access refs during render»): оба ref'а нужны только затем,
    // чтобы колбэк `IntersectionObserver` (созданный ниже) видел актуальные `onLoadMore`/
    // `isLoading`, не пересоздавая сам наблюдатель на каждый их рендер.
    useEffect(() => {
        onLoadMoreRef.current = onLoadMore
        isLoadingRef.current = isLoading
    })

    useEffect(() => {
        if (!hasMore) return
        if (typeof IntersectionObserver === 'undefined') return
        const node = sentinelRef.current
        if (node === null) return

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting && !isLoadingRef.current) {
                    onLoadMoreRef.current()
                }
            },
            { rootMargin },
        )
        observer.observe(node)
        return () => observer.disconnect()
    }, [hasMore, rootMargin])

    return sentinelRef
}

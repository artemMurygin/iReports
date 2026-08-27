import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'

import { useInfiniteScrollTrigger } from './useInfiniteScrollTrigger.ts'

/**
 * jsdom не реализует `IntersectionObserver` — стаб ниже подменяет глобальный конструктор своим,
 * который просто запоминает переданные callback/options и даёт тесту вызвать callback вручную
 * (симуляция «sentinel показался во вьюпорте»), плюс считает `disconnect()`, чтобы проверить
 * отписку при размонтировании/смене `hasMore`.
 */
type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void

class FakeIntersectionObserver {
    static instances: FakeIntersectionObserver[] = []
    observedNodes: Element[] = []
    disconnectCalls = 0
    callback: ObserverCallback
    options?: IntersectionObserverInit
    constructor(callback: ObserverCallback, options?: IntersectionObserverInit) {
        this.callback = callback
        this.options = options
        FakeIntersectionObserver.instances.push(this)
    }
    observe(node: Element) {
        this.observedNodes.push(node)
    }
    disconnect() {
        this.disconnectCalls += 1
    }
    unobserve() {}
    trigger(isIntersecting: boolean) {
        this.callback([{ isIntersecting }])
    }
}

beforeEach(() => {
    FakeIntersectionObserver.instances = []
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
})

afterEach(() => {
    vi.unstubAllGlobals()
})

/**
 * Небольшой тестовый компонент вместо `renderHook` + ручного присвоения `.current` — реальный
 * `<div ref={sentinelRef} />` нужен для того, чтобы ref был приложен к настоящему DOM-узлу ДО
 * запуска эффекта (так же, как в реальном рендере `TransactionsLedger`/`TransactionsCardList`);
 * `renderHook` без реального узла оставляет `ref.current === null` к моменту эффекта.
 */
function Harness({ hasMore, isLoading, onLoadMore }: { hasMore: boolean; isLoading: boolean; onLoadMore: () => void }) {
    const sentinelRef = useInfiniteScrollTrigger<HTMLDivElement>({ hasMore, isLoading, onLoadMore })
    return <div data-testid="sentinel" ref={sentinelRef} />
}

describe('useInfiniteScrollTrigger', () => {
    it('creates an observer and starts observing the sentinel node when hasMore is true', () => {
        render(<Harness hasMore={true} isLoading={false} onLoadMore={vi.fn()} />)
        expect(FakeIntersectionObserver.instances).toHaveLength(1)
        expect(FakeIntersectionObserver.instances[0].observedNodes).toHaveLength(1)
    })

    it('does not create an observer when hasMore is false', () => {
        render(<Harness hasMore={false} isLoading={false} onLoadMore={vi.fn()} />)
        expect(FakeIntersectionObserver.instances).toHaveLength(0)
    })

    it('calls onLoadMore once the sentinel intersects the viewport', () => {
        const onLoadMore = vi.fn()
        render(<Harness hasMore={true} isLoading={false} onLoadMore={onLoadMore} />)
        FakeIntersectionObserver.instances[0].trigger(true)
        expect(onLoadMore).toHaveBeenCalledTimes(1)
    })

    it('does not call onLoadMore when the sentinel is not intersecting', () => {
        const onLoadMore = vi.fn()
        render(<Harness hasMore={true} isLoading={false} onLoadMore={onLoadMore} />)
        FakeIntersectionObserver.instances[0].trigger(false)
        expect(onLoadMore).not.toHaveBeenCalled()
    })

    it('does not call onLoadMore while a page is already loading (isLoading: true)', () => {
        const onLoadMore = vi.fn()
        render(<Harness hasMore={true} isLoading={true} onLoadMore={onLoadMore} />)
        FakeIntersectionObserver.instances[0].trigger(true)
        expect(onLoadMore).not.toHaveBeenCalled()
    })

    it('reads the latest onLoadMore without recreating the observer when only the callback identity changes', () => {
        const first = vi.fn()
        const second = vi.fn()
        const { rerender } = render(<Harness hasMore={true} isLoading={false} onLoadMore={first} />)

        rerender(<Harness hasMore={true} isLoading={false} onLoadMore={second} />)
        expect(FakeIntersectionObserver.instances).toHaveLength(1)

        FakeIntersectionObserver.instances[0].trigger(true)
        expect(first).not.toHaveBeenCalled()
        expect(second).toHaveBeenCalledTimes(1)
    })

    it('disconnects the observer when hasMore flips back to false', () => {
        const { rerender } = render(<Harness hasMore={true} isLoading={false} onLoadMore={vi.fn()} />)
        const instance = FakeIntersectionObserver.instances[0]

        rerender(<Harness hasMore={false} isLoading={false} onLoadMore={vi.fn()} />)
        expect(instance.disconnectCalls).toBe(1)
    })

    it('disconnects the observer on unmount', () => {
        const { unmount } = render(<Harness hasMore={true} isLoading={false} onLoadMore={vi.fn()} />)
        const instance = FakeIntersectionObserver.instances[0]

        unmount()
        expect(instance.disconnectCalls).toBe(1)
    })
})

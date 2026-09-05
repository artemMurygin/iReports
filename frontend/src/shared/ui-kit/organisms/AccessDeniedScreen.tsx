type Props = {
    title?: string
    description?: string
}

// Заглушка `AccessDeniedScreen` (add-bitrix24-auth-and-rbac, раздел 16
// tasks.md) — нужна `features/Auth/ui/RequirePermission`, чтобы было что
// рендерить при отсутствии права; полноценная вёрстка по фрейму `WZqMK`
// (design/sallary-first-iteration.pen) — раздел 17 tasks.md
// (`shared/ui-kit/organisms/AccessDeniedScreen`, `title?`/`description?` —
// те же пропсы, что уже здесь, architecture.md), которая заменит разметку
// этого компонента, не его сигнатуру.
export function AccessDeniedScreen({ title = 'Нет доступа', description }: Props) {
    return (
        <div role="alert">
            <p>{title}</p>
            {description !== undefined ? <p>{description}</p> : null}
        </div>
    )
}

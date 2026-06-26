export function ErrorLayout({ error }: { error: string | null }) {
    return (
        <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            Ошибка загрузки данных: {error}
        </div>
    )
}
import { StorageError } from '@/shared/errors/storageError.ts'

export function saveDataToStorage<T>(key: string, filters: T): void {
    try {
        localStorage.setItem(key, JSON.stringify(filters))
    } catch (error) {
        throw new StorageError('Не удалось загрузить данные в LocalStorage' + error)
    }
}

export function loadDataFromStorage<T>(key: string): T | null {
    try {
        const raw = localStorage.getItem(key)
        if (!raw) return null
        return JSON.parse(raw)
    } catch (error) {
        throw new StorageError('Не удалось загрузить данные из LocalStorage' + error)
    }
}

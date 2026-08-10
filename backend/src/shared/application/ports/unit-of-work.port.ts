// Порт для оборачивания нескольких вызовов репозиториев в одну транзакцию,
// когда за это отвечает application-слой (хендлер, координирующий больше
// одного репозитория/агрегата), а не единственный репозиторий.
export interface UnitOfWorkPort {
    run<T>(work: () => Promise<T>): Promise<T>;
}

export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

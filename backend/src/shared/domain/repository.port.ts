/*  Общий generic-контракт репозитория (RepositoryPort<Entity> с insert/
    findOneById/findAll/findAllPaginated/delete/transaction) был удалён:
    Prisma-репозитории пишут явные типизированные методы под конкретный
    агрегат (см. sales.repositories.ts, motivation-schema.repository.ts),
    а не наследуют CRUD "про запас". Здесь остаются только value-типы для
    пагинации, которые репозиторий, которому она реально нужна, использует
    в своей сигнатуре напрямую.
*/

export class Paginated<T> {
    readonly count: number;
    readonly limit: number;
    readonly page: number;
    readonly data: readonly T[];

    constructor(props: Paginated<T>) {
        this.count = props.count;
        this.limit = props.limit;
        this.page = props.page;
        this.data = props.data;
    }
}

export type OrderBy = { field: string | true; param: 'asc' | 'desc' };

export type PaginatedQueryParams = {
    limit: number;
    page: number;
    offset: number;
    orderBy: OrderBy;
};

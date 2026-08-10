import { RequestContext } from 'nestjs-request-context';
import { Prisma } from '../../../../prisma/generated/prisma/schema/client';
// import type — AggregateRoot тут используется только как тип; обычный
// import создал бы циклическую зависимость в рантайме, т.к.
// aggregate-root.base.ts сам импортирует RequestContextService отсюда же.
import type { AggregateRoot } from '../../domain/aggregate-root.base';

/**
 * Setting some isolated context for each request.
 */

export class AppRequestContext extends RequestContext {
    requestId: string;
    transactionConnection?: Prisma.TransactionClient; // For global transactions

    // Агрегаты, чьи domain-события ждут публикации после коммита текущей
    // транзакции (см. DatabaseService.withTransaction). Репозитории кладут
    // сюда сущность сразу после успешной записи, а не публикуют события
    // сами — на момент записи ещё не известно, закоммитится ли вся
    // (возможно, более широкая) транзакция целиком.
    pendingAggregates?: AggregateRoot<unknown>[];
}

export class RequestContextService {
    static getContext(): AppRequestContext {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const ctx: AppRequestContext = RequestContext.currentContext.req;
        return ctx;
    }

    static setRequestId(id: string): void {
        const ctx = this.getContext();
        ctx.requestId = id;
    }

    static getRequestId(): string {
        return this.getContext().requestId;
    }

    static getTransactionConnection(): Prisma.TransactionClient | undefined {
        const ctx = this.getContext();
        return ctx.transactionConnection;
    }

    static setTransactionConnection(
        transactionConnection?: Prisma.TransactionClient,
    ): void {
        const ctx = this.getContext();
        ctx.transactionConnection = transactionConnection;
    }

    static cleanTransactionConnection(): void {
        const ctx = this.getContext();
        ctx.transactionConnection = undefined;
    }

    static trackAggregateForEvents(aggregate: AggregateRoot<unknown>): void {
        const ctx = this.getContext();
        (ctx.pendingAggregates ??= []).push(aggregate);
    }

    // Забирает и очищает очередь: используется withTransaction — после
    // успешного коммита (чтобы опубликовать) и при откате/ошибке (чтобы
    // просто отбросить, не публикуя события для данных, которых нет в БД).
    static drainPendingAggregates(): AggregateRoot<unknown>[] {
        const ctx = this.getContext();
        const aggregates = ctx.pendingAggregates ?? [];
        ctx.pendingAggregates = [];
        return aggregates;
    }
}

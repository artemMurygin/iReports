import { RequestContext } from 'nestjs-request-context';
import { Prisma } from '../../../../prisma/generated/prisma/schema/client';

/**
 * Setting some isolated context for each request.
 */

export class AppRequestContext extends RequestContext {
  requestId: string;
  transactionConnection?: Prisma.TransactionClient; // For global transactions
}

export class RequestContextService {
  static getContext(): AppRequestContext {
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
}

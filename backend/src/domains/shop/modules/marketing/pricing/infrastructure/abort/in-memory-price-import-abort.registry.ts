import { Injectable } from '@nestjs/common';
import type { PriceImportAbortRegistry } from '../../application/ports/price-import-abort-registry.port';

@Injectable()
export class InMemoryPriceImportAbortRegistry implements PriceImportAbortRegistry {
    private readonly controllers = new Map<string, AbortController>();

    register(id: string): AbortSignal {
        const controller = new AbortController();
        this.controllers.set(id, controller);
        return controller.signal;
    }

    abort(id: string): void {
        this.controllers.get(id)?.abort();
    }

    release(id: string): void {
        this.controllers.delete(id);
    }
}

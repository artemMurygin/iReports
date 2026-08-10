import { LeadEntity } from '../entities/lead.entity';
import { DealEntity } from '../entities/deal.entity';
// Порт: читает уже синхронизированные Bitrix-сделки как домен "Lead".
// Запись в БД (fetch из Bitrix + upsert) — не забота этого домена, см. src1/sync/bitrix.
export interface LeadRepositoryPort {
    findModifiedSince(since: Date): Promise<LeadEntity[]>;
}

export interface DealRepositoryPort {
    findModifiedSince(since: Date): Promise<DealEntity[]>;
}

export const LEAD_REPOSITORY = Symbol('LEAD_REPOSITORY');
export const DEAL_REPOSITORY = Symbol('DEAL_REPOSITORY');

import { Injectable } from '@nestjs/common';
import axios from 'axios';

// Экспортируется отдельно (а не только как значение axios `defaults.baseURL`),
// чтобы код, которому нужно построить href сущности API МойСклад из локального
// id (см. `fetchTurnoverAllAt` в moysklad.service.ts, фильтр `store=<href>`),
// мог использовать константу напрямую — без зависимости от того, замокан ли
// `MoyskladHttpService.instance.defaults` в конкретном тесте.
export const MOYSKLAD_BASE_URL = 'https://api.moysklad.ru/api/remap/1.2';

@Injectable()
export class MoyskladHttpService {
    readonly instance = axios.create({
        baseURL: MOYSKLAD_BASE_URL,
        headers: { Authorization: `Bearer ${process.env.MOYSKLAD_TOKEN}` },
    });
}

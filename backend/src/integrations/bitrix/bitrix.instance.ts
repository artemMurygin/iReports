import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class BitrixHttpService {
    readonly instance = axios.create({
        baseURL: process.env.BITRIX24_WEBHOOK_URL,
        timeout: 30_000,
    });

    readonly BITRIX_DELAY_MS = 500;
}

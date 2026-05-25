import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class MoyskladHttpService {
  readonly instance = axios.create({
    baseURL: 'https://api.moysklad.ru/api/remap/1.2',
    headers: { Authorization: `Bearer ${process.env.MOYSKLAD_TOKEN}` },
  });
}

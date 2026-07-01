import { Injectable } from '@nestjs/common';
import axios from 'axios';
import qs from 'qs';

@Injectable()
export class RoappHttpService {
  readonly instance = axios.create({
    baseURL: 'https://api.roapp.io/v2',
    headers: { Authorization: `Bearer ${process.env.ROAPP_TOKEN}` },
    paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'brackets' }),
  });
}

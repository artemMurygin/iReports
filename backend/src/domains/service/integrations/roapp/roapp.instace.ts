import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class RoappHttpService {
  readonly instance = axios.create({
    baseURL: 'https://api.roapp.io/v2',
    headers: { Authorization: `Bearer ${process.env.ROAPP_TOKEN}` },
  });
}

import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class CustomApiRoappHttpService {
    readonly instance = axios.create({
        baseURL: 'https://rm.murygin.tech',
    });
}

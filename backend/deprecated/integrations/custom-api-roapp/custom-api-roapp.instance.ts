import axios from 'axios';

export class CustomApiRoappHttpService {
  readonly instance = axios.create({
    baseURL: 'https://rm.murygin.tech',
  });
}

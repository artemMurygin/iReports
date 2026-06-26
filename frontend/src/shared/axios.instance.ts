import axios from 'axios'
import qs from 'qs'

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
    headers: {
        'Content-Type': 'application/json'
    },
    paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'repeat' })
})
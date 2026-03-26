import axios from 'axios';
import 'dotenv/config';

// --- Bitrix ---

const bitrix = axios.create({
    baseURL: process.env.BITRIX24_WEBHOOK_URL
})

// --- Avito ---

interface AvitoTokenResponse {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    token_type: string;
}

let avitoAccessToken: string | null = null;
let avitoRefreshToken: string | null = null;
let avitoTokenExpiresAt: number = 0;

async function fetchAvitoToken(): Promise<void> {
    const params = new URLSearchParams({
        client_id: process.env.AVITO_CLIENT_ID!,
        client_secret: process.env.AVITO_CLIENT_SECRET!,
        grant_type: 'client_credentials',
    });

    const { data } = await axios.post<AvitoTokenResponse>(
        'https://api.avito.ru/token/',
        params,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    avitoAccessToken = data.access_token;
    avitoRefreshToken = data.refresh_token ?? null;
    avitoTokenExpiresAt = Date.now() + data.expires_in * 1000;
}

async function refreshAvitoToken(): Promise<void> {
    if (!avitoRefreshToken) {
        return fetchAvitoToken();
    }

    const params = new URLSearchParams({
        client_id: process.env.AVITO_CLIENT_ID!,
        client_secret: process.env.AVITO_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: avitoRefreshToken,
    });

    const { data } = await axios.post<AvitoTokenResponse>(
        'https://api.avito.ru/token/',
        params,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    avitoAccessToken = data.access_token;
    avitoRefreshToken = data.refresh_token ?? avitoRefreshToken;
    avitoTokenExpiresAt = Date.now() + data.expires_in * 1000;
}

async function getAvitoToken(): Promise<string> {
    if (!avitoAccessToken || Date.now() >= avitoTokenExpiresAt) {
        await refreshAvitoToken();
    }
    return avitoAccessToken!;
}

const avito = axios.create({
    baseURL: 'https://api.avito.ru',
});

avito.interceptors.request.use(async (config) => {
    const token = await getAvitoToken();
    config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export { bitrix, avito }
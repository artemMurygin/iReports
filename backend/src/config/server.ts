import 'dotenv/config';
import express, { Express } from 'express'
import morgan from 'morgan'
import cors from 'cors'
import cookieParser from 'cookie-parser'


const corsOptions = {
    origin: process.env.DEV_URL,
    credentials: true
};

morgan.token('custom', (req, res) => {
    const green = '\x1b[32m';
    const yellow = '\x1b[33m';
    const red = '\x1b[31m';
    const reset = '\x1b[0m';

    let color = reset;
    if (res.statusCode >= 200 && res.statusCode < 300) color = green;
    else if (res.statusCode >= 300 && res.statusCode < 500) color = yellow;
    else if (res.statusCode >= 500) color = red;

    return `${req.method} ${req.url} ${color}${res.statusCode}${reset}`;
});

function serverConfig(app: Express) {
    app.use(cors(corsOptions));
    app.use(cookieParser());
    app.use(morgan(':custom'));
    app.use(express.json());
    app.use(express.urlencoded({extended: true}));
}

export { serverConfig }
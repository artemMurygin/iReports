import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class AiHttpService {
    readonly client = new OpenAI({
        apiKey: process.env.OMNIROTE_TOKEN,
        baseURL: process.env.OMNIROTE_URL,
    });
}

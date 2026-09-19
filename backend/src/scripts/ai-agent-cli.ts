import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DeepAgentService } from '../modules/ai-agent/infrastructure/deep-agent/deep-agent.service';

async function bootstrap() {
    const message = process.argv.slice(2).join(' ');

    if (!message) {
        console.error('Usage: npm run ai-agent -- "<сообщение>"');
        process.exit(1);
    }

    const app = await NestFactory.createApplicationContext(AppModule);

    try {
        const deepAgent = app.get(DeepAgentService);
        const answer = await deepAgent.ask(message);
        console.log(answer);

        await app.close();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

void bootstrap();

import { Module } from '@nestjs/common';
import { DeepAgentService } from './infrastructure/deep-agent/deep-agent.service';

// Сквозной модуль (src/modules/*, см. backend/CLAUDE.md, «Layering inside a
// domain module»). Пока только базовый DeepAgentService для CLI-вызова
// (src/scripts/ai-agent-cli.ts) — domain/application/interface появятся
// вместе с HTTP-эндпоинтом или бизнес-логикой поверх агента.
@Module({
    providers: [DeepAgentService],
    exports: [DeepAgentService],
})
export class AiAgentModule {}

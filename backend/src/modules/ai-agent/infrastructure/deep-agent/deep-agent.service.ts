import { Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { createDeepAgent } from 'deepagents';
import { AIMessage } from '@langchain/core/messages';

const 


@Injectable()
export class DeepAgentService {
    private agent?: ReturnType<typeof createDeepAgent>;
    private readonly DEFAULT_MODEL = process.env.OMNIROUTE_BASE_MODEL ?? 'cx/gpt-5.5-medium';
    
    private getAgent(): ReturnType<typeof createDeepAgent> {
        if (!this.agent) {
            this.agent = createDeepAgent({
                model: this.createAgentModel(),
                systemPrompt: 'Ты — ассистент внутренней платформы iReports.',
            });
        }
        return this.agent;
    }

    async ask(message: string, threadId = 'cli'): Promise<string> {
        // invoke() резолвится в `any` из-за сложной цепочки generic-типов
        // deepagents/langchain (CreateDeepAgentParams -> ReactAgent) — не
        // ошибка типизации, реальный shape ответа документирован в
        // deep-agents-core skill (result.messages: BaseMessage[]).
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const result = await this.getAgent().invoke(
            { messages: [{ role: 'user', content: message }] },
            { configurable: { thread_id: threadId } },
        );

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const lastMessage = result.messages.at(-1);
        return lastMessage instanceof AIMessage
            ? lastMessage.text
            : // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              String(lastMessage?.content ?? '');
    }


    // Тот же OmniRoute-гейтвей, что использует AiHttpService
    // (src/integrations/ai/ai.instance.ts), но как LangChain chat-model для
    // deepagents.createDeepAgent, который принимает готовый инстанс модели,
    // а не голое имя провайдера.
    createAgentModel(): ChatOpenAI {
        return new ChatOpenAI({
            apiKey: process.env.OMNIROTE_TOKEN,
            model: DEFAULT_MODEL,
            configuration: { baseURL: process.env.OMNIROTE_URL },
        });
    }
}

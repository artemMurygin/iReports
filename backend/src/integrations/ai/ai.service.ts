require('dotenv');
import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { AiHttpService } from './ai.instance';
import { ChatMessage, ChatOptions, EmbeddingOptions } from './ai.types';

const RETRY_ATTEMPTS = 3;
const RETRY_INITIAL_DELAY_MS = 3000;

@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);

    constructor(private ai: AiHttpService) {}

    /**
     * Повторяет fn при 504 Gateway Timeout с экспоненциальным бэкоффом.
     * Все остальные ошибки пробрасываются немедленно.
     */
    private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
        let delayMs = RETRY_INITIAL_DELAY_MS;

        for (let attempt = 1; attempt <= RETRY_ATTEMPTS + 1; attempt++) {
            try {
                return await fn();
            } catch (error: unknown) {
                const status = (error as { status?: number })?.status;
                const is504 = status === 504;

                if (!is504 || attempt > RETRY_ATTEMPTS) {
                    throw error;
                }

                this.logger.warn(
                    `504 Gateway Timeout — попытка ${attempt}/${RETRY_ATTEMPTS}, повтор через ${delayMs} мс...`,
                );
                await new Promise((resolve) => setTimeout(resolve, delayMs));
                delayMs *= 2;
            }
        }

        // Недостижимо, нужно для вывода типов TypeScript
        throw new Error('withRetry: unreachable');
    }

    /**
     * Создать эмбединг для одной строки текста.
     * Возвращает вектор чисел.
     */
    async createEmbedding(
        text: string,
        options: EmbeddingOptions = {},
    ): Promise<number[]> {
        try {
            const response = await this.withRetry(() =>
                this.ai.client.embeddings.create({
                    model: options.model ?? 'text-embedding-3-small',
                    input: text,
                }),
            );
            return response.data[0].embedding;
        } catch (error) {
            throw new BadGatewayException(
                `Failed to create embedding: ${error.message}`,
            );
        }
    }

    /**
     * Создать эмбединги для массива текстов за один запрос.
     * Возвращает массив векторов в том же порядке.
     */
    async createEmbeddings(
        texts: string[],
        options: EmbeddingOptions = {},
    ): Promise<number[][]> {
        try {
            const response = await this.withRetry(() =>
                this.ai.client.embeddings.create({
                    model: options.model ?? 'text-embedding-3-small',
                    input: texts,
                }),
            );
            return response.data
                .sort((a, b) => a.index - b.index)
                .map((item) => item.embedding);
        } catch (error) {
            throw new BadGatewayException(
                `Failed to create embeddings: ${error.message}`,
            );
        }
    }

    /**
     * Отправить сообщения в чат и получить ответ строкой.
     */
    async chat(
        messages: ChatMessage[],
        options: ChatOptions = {},
    ): Promise<string> {
        try {
            const allMessages = options.systemPrompt
                ? [
                      {
                          role: 'system' as const,
                          content: options.systemPrompt,
                      },
                      ...messages,
                  ]
                : messages;

            const requestOptions = options.headers
                ? { headers: options.headers }
                : undefined;

            if (options.stream) {
                const stream = await this.withRetry(() =>
                    this.ai.client.chat.completions.create(
                        {
                            model:
                                options.model ??
                                process.env.OMNIROUTE_BASE_MODEL ??
                                'cx/gpt-5.5-medium',
                            messages: allMessages,
                            temperature: options.temperature ?? 0.7,
                            max_tokens: options.maxTokens,
                            stream: true,
                        },
                        requestOptions,
                    ),
                );

                let result = '';
                for await (const chunk of stream) {
                    result += chunk.choices[0]?.delta?.content ?? '';
                }
                return result;
            }

            const response = await this.withRetry(() =>
                this.ai.client.chat.completions.create(
                    {
                        model:
                            options.model ??
                            process.env.OMNIROUTE_BASE_MODEL ??
                            'cx/gpt-5.5-medium',
                        messages: allMessages,
                        temperature: options.temperature ?? 0.7,
                        max_tokens: options.maxTokens,
                    },
                    requestOptions,
                ),
            );

            return response.choices[0].message.content ?? '';
        } catch (error) {
            throw new BadGatewayException(
                `Failed to get chat completion: ${error.message}`,
            );
        }
    }

    /**
     * Простой запрос к ИИ с одним пользовательским сообщением.
     */
    async ask(prompt: string, options: ChatOptions = {}): Promise<string> {
        return this.chat([{ role: 'user', content: prompt }], options);
    }
}

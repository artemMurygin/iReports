import { BadGatewayException, Injectable } from '@nestjs/common';
import { AiHttpService } from './ai.instance';
import { ChatMessage, ChatOptions, EmbeddingOptions } from './ai.types';

@Injectable()
export class AiService {
  constructor(private ai: AiHttpService) {}

  /**
   * Создать эмбединг для одной строки текста.
   * Возвращает вектор чисел.
   */
  async createEmbedding(
    text: string,
    options: EmbeddingOptions = {},
  ): Promise<number[]> {
    try {
      const response = await this.ai.client.embeddings.create({
        model: options.model ?? 'text-embedding-3-small',
        input: text,
      });
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
      const response = await this.ai.client.embeddings.create({
        model: options.model ?? 'text-embedding-3-small',
        input: texts,
      });
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
            { role: 'system' as const, content: options.systemPrompt },
            ...messages,
          ]
        : messages;

      if (options.stream) {
        const stream = await this.ai.client.chat.completions.create({
          model: options.model ?? 'cx/gpt-5.4',
          messages: allMessages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens,
          stream: true,
        });

        let result = '';
        for await (const chunk of stream) {
          result += chunk.choices[0]?.delta?.content ?? '';
        }
        return result;
      }

      const response = await this.ai.client.chat.completions.create({
        model: options.model ?? 'cx/gpt-5.4',
        messages: allMessages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
      });

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

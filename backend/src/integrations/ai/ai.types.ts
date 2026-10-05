export type ChatMessage = {
    role: 'system' | 'user' | 'assistant';
    content: string;
};

export type ChatOptions = {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    stream?: boolean;
    headers?: Record<string, string>;
    /** Отмена запроса: абортит HTTP/стрим к LLM и прерывает backoff повторов. */
    signal?: AbortSignal;
};

export type EmbeddingOptions = {
    model?: string;
};

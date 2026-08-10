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
};

export type EmbeddingOptions = {
    model?: string;
};

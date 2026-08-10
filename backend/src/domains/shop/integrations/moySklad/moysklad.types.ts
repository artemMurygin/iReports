export type MoyskladListParams = {
    limit: number;
    offset: number;
    filter?: string;
    updatedFrom?: string;
    updatedTo?: string;
};

export type MoyskladMeta = {
    size: number;
    limit: number;
    offset: number;
};

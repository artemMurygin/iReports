import { BitrixDealSchema } from './schema';
import { z } from 'zod';

export type RawBitrixDeal = z.infer<typeof BitrixDealSchema>;

export type Filter = {
  CATEGORY_ID: number[] | number;
  '>=DATE_MODIFY'?: string;
  '>=DATE_CREATE'?: string;
};

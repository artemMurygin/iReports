import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { MoyskladService } from '../integrations/moySklad/moysklad.service';
import { AiService } from '../integrations/ai/ai.service';
import { DatabaseService } from '../database/database.service';
import { delay } from './delay';

const EMBEDDING_BATCH_SIZE = 100;

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size)
    result.push(arr.slice(i, i + size));
  return result;
}

function loadFilters(): string {
  const filterPath = path.join(process.cwd(), 'src', 'utils', 'filter.md');

  if (!fs.existsSync(filterPath)) {
    console.warn('filter.md не найден — запрос без фильтров');
    return '';
  }

  const lines = fs
    .readFileSync(filterPath, 'utf-8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  if (lines.length === 0) {
    console.warn('filter.md пуст — запрос без фильтров');
    return '';
  }

  return lines.join(';');
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const moysklad = app.get(MoyskladService);
  const ai = app.get(AiService);
  const db = app.get(DatabaseService);

  const filter = loadFilters();
  console.log(filter ? `Фильтр: ${filter}` : 'Фильтры не заданы');

  const items: { id: string; name: string }[] = [];
  for await (const page of moysklad.fetchAssortment(filter || undefined)) {
    items.push(...page);
    console.log(`Загружено: ${items.length}`);
  }
  console.log(`Итого: ${items.length} позиций`);

  if (items.length === 0) {
    console.log('Нет данных для обработки.');
    await app.close();
    return;
  }

  await db.$executeRaw`TRUNCATE TABLE "moySklad_nomenclature_embeddings"`;
  console.log('Таблица очищена');

  const batches = chunk(items, EMBEDDING_BATCH_SIZE);
  let processed = 0;

  for (const batch of batches) {
    const embeddings = await ai.createEmbeddings(batch.map((i) => i.name));

    for (let i = 0; i < batch.length; i++) {
      const { id, name } = batch[i];
      const vectorStr = `[${embeddings[i].join(',')}]`;

      await db.$executeRawUnsafe(
        `INSERT INTO "moySklad_nomenclature_embeddings" ("externalId", "name", "embedding", "createdAt")
         VALUES ($1, $2, $3::vector, NOW())`,
        id,
        name,
        vectorStr,
      );
    }

    processed += batch.length;
    console.log(`Эмбединги: ${processed} / ${items.length}`);
    await delay(500);
  }

  console.log(`Готово! Записано ${processed} записей.`);
  await app.close();
}

bootstrap();

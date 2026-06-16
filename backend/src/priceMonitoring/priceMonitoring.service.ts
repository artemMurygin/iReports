import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { AiService } from '../integrations/ai/ai.service';
import { DatabaseService } from '../database/database.service';
import { GoogleSheetsService } from '../integrations/google-sheets/google-sheets.service';
import { MoyskladService } from '../integrations/moySklad/moysklad.service';
import { PriceMonitoringProgressService } from './priceMonitoring.progress.service';
import {
  AiMatchItem,
  CategoryGroup,
  CategoryKey,
  JobProgressEvent,
  MatchedProduct,
  ProductRow,
  VectorCandidate,
} from './priceMonitoring.types';
import { Subject } from 'rxjs';
import {
  CATEGORY_MS_FILTER,
  IPAD_MACBOOK_PATTERNS,
  SHEET_GID,
  SHEET_IPAD_MACBOOK,
  SHEET_IPHONE_WATCH,
  SPREADSHEET_ID,
} from './priceMonitoring.config';
import {
  buildMatchingPrompt,
  parseMatchingResponse,
} from './priceMonitoring.prompts';
import { delay } from '../utils/delay';

@Injectable()
export class PriceMonitoringService {
  constructor(
    private readonly ai: AiService,
    private readonly db: DatabaseService,
    private readonly sheets: GoogleSheetsService,
    private readonly moysklad: MoyskladService,
    private readonly progress: PriceMonitoringProgressService,
  ) {}

  async updateShopProductsCosts(
    fileBase64: string,
    uuid: string,
  ): Promise<void> {
    this.progress.create(uuid);
    const emit = (
      step: string,
      message: string,
      status: JobProgressEvent['status'] = 'progress',
    ) => {
      console.log(`[${uuid}] [${step}] ${message}`);
      this.progress.emit(uuid, { step, message, status });
    };

    try {
      emit('parseXlsx', 'Парсинг прайса...');
      const categories = await this.parseXlsx(fileBase64);

      emit('loadCatalog', 'Загрузка каталога МойСклад...');
      await this.loadMoySkladCatalog(categories, uuid);

      emit('matchCategories', 'Сопоставление с номенклатурой...');
      const matched = await this.matchAllCategories(categories, uuid);
      console.log(`Итого сопоставлено: ${matched.length} позиций`);

      const updates = this.buildMoySkladUpdates(matched);
      emit(
        'updateMoySklad',
        `Обновление МойСклад (${updates.length} позиций)...`,
      );
      await this.moysklad.batchUpdateProducts(updates);
      console.log(`МойСклад обновлён`);

      emit('writeSheet', 'Запись результатов в таблицу...');
      await this.writeResultsToSheet(matched);

      emit('done', 'Готово', 'done');
    } catch (e) {
      console.error(`[${uuid}] Ошибка:`, e);
      emit('error', e?.message ?? String(e), 'error');
    } finally {
      this.progress.getSubject(uuid)?.complete();
      // job оставляем в Map — клиент ещё может запросить latest через polling
      setTimeout(() => this.progress.delete(uuid), 60_000);
    }
  }

  private async resetCostsToNull(): Promise<void> {
    const sheetName = await this.sheets.getSheetNameByGid(
      SPREADSHEET_ID,
      SHEET_GID,
    );

    const rows = await this.sheets.getRows(SPREADSHEET_ID, {
      range: `${sheetName}!A3:AN`,
    });

    // rows[0] = строка 3 (заголовок), rows[1] = строка 4, rows[2..] = данные с 5-й строки
    const dataRows = rows.slice(2);

    const rowsWithId = dataRows
      .map((row, i) => ({ row, sheetRow: 5 + i }))
      .filter(({ row }) => row[0]?.toString().trim() !== '');

    if (rowsWithId.length === 0) return;

    const updates = rowsWithId.map(({ sheetRow }) => ({
      range: `${sheetName}!AN${sheetRow}`,
      values: [['0']],
    }));

    await this.sheets.updateRows(SPREADSHEET_ID, updates);
    console.log(`Сброшено "Закуп" до 0: ${updates.length} строк`);
  }

  private async parseXlsx(fileBase64: string): Promise<CategoryGroup[]> {
    try {
      const buffer = Buffer.from(fileBase64, 'base64');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      console.log(`Листы в файле: ${workbook.SheetNames.join(', ')}`);

      const iphoneWatchRows = this.parseIphoneWatchSheet(workbook);
      console.log(`iPhone/Watch: ${iphoneWatchRows.length} строк`);

      const ipadMacbookRows = await this.parseIpadMacbookSheet(workbook);
      console.log(`iPad/MacBook: ${ipadMacbookRows.length} строк`);

      const rows = [...iphoneWatchRows, ...ipadMacbookRows];
      console.log(`Всего строк после парсинга: ${rows.length}`);

      const categories = this.categorize(rows);
      console.log(
        `Категории: ${categories.map((c) => `${c.category}(${c.priceRows.length})`).join(', ')}`,
      );

      return categories;
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(`Failed to parse XLSX file: ${e.message}`);
    }
  }

  private parseIphoneWatchSheet(workbook: XLSX.WorkBook): ProductRow[] {
    const sheet = workbook.Sheets[SHEET_IPHONE_WATCH];
    if (!sheet) {
      throw new BadRequestException(`Sheet "${SHEET_IPHONE_WATCH}" not found`);
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
    });

    return rows
      .slice(3)
      .map((row) => ({
        name: (row as unknown[])[1] as string,
        price: (row as unknown[])[3] as string | number | null,
      }))
      .filter((r) => r.name != null && r.name !== '');
  }

  private async parseIpadMacbookSheet(
    workbook: XLSX.WorkBook,
  ): Promise<ProductRow[]> {
    const sheet = workbook.Sheets[SHEET_IPAD_MACBOOK];
    if (!sheet) {
      throw new BadRequestException(`Sheet "${SHEET_IPAD_MACBOOK}" not found`);
    }

    const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
    });

    const matched = raw
      .slice(4)
      .map((row) => ({
        name: (row as unknown[])[0] as string,
        price: (row as unknown[])[2] as string | number | null,
      }))
      .filter(
        (r) =>
          r.name != null &&
          r.name !== '' &&
          IPAD_MACBOOK_PATTERNS.some((p) => p.test(r.name)),
      );

    if (matched.length === 0) return [];

    console.log(`Форматирование ${matched.length} строк через AI...`);
    const formattedNames = await this.formatNamesViaAi(
      matched.map((r) => r.name),
    );
    return matched.map((r, i) => ({ ...r, name: formattedNames[i] ?? r.name }));
  }

  private async formatNamesViaAi(names: string[]): Promise<string[]> {
    const prompt = `Ты приводишь названия товаров Apple к единому стандартному формату.

  Правила форматирования:

  **MacBook:**
  Apple MacBook [Air/Pro/Neo] [13/14/15/16]" [Цвет] ([Процессор], [RAM]GB, [SSD])
  Пример: Apple MacBook Air 13" Midnight (M5, 16GB, 512GB)

  **iPad:**
  Apple iPad [Air/Pro/Mini/classic] [11/13]" [Цвет] [Wi-Fi/Wi-Fi+Cellular] [Память]GB ([Процессор], [Год])
  Пример: Apple iPad Air 11" Space Gray Wi-Fi 128GB (M4, 2026)

  **iPhone:**
  Apple iPhone [модель] [память]GB [Цвет] ([SIM-тип])
  Пример: Apple iPhone 16 Pro Max 256GB Desert Titanium (nano SIM+eSIM)

  **Apple Watch:**
  Apple Watch [серия] [размер]mm [Цвет корпуса] ([ремешок])
  Пример: Apple Watch Series 11 42mm Black (Sport Band Black)

  **AirPods:**
  Apple AirPods [модель] [цвет если есть]
  Пример: Apple AirPods Pro 3

  **iMac:**
  Apple iMac [Цвет] ([Процессор], [CPU-cores]/[GPU-cores], [RAM]GB, [SSD])
  Пример: Apple iMac Silver (M4, 8-Core CPU/8-Core GPU, 16GB, 256GB)

  **Аксессуары (Pencil, Keyboard, Mouse, Trackpad, Display):**
  Apple [название аксессуара] [цвет если есть]
  Пример: Apple Pencil Pro

  Отформатируй следующие названия. Верни ТОЛЬКО JSON-массив строк в том же порядке, без пояснений и markdown:
  ${JSON.stringify(names)}`;

    const response = await this.ai.ask(prompt, { temperature: 0 });
    try {
      return JSON.parse(response.trim()) as string[];
    } catch {
      return names;
    }
  }

  private categorize(rows: ProductRow[]): CategoryGroup[] {
    const rules: { key: CategoryKey; patterns: RegExp[] }[] = [
      { key: 'iPhone', patterns: [/iphone/i] },
      { key: 'MacBook', patterns: [/macbook/i, /\bneo\b/i] },
      {
        key: 'Watch',
        patterns: [/apple\s+watch/i, /watch\s+(se|s\d+|ultra)/i],
      },
      { key: 'iPad', patterns: [/ipad/i, /iPro/i] },
      { key: 'AirPods', patterns: [/airpods/i] },
    ];

    const groups = new Map<CategoryKey, ProductRow[]>();

    for (const row of rows) {
      for (const rule of rules) {
        if (rule.patterns.some((p) => p.test(row.name))) {
          if (!groups.has(rule.key)) groups.set(rule.key, []);
          groups.get(rule.key)!.push(row);
          break;
        }
      }
    }

    return Array.from(groups.entries()).map(([category, priceRows]) => ({
      category,
      priceRows,
      moySkladCatalogRows: [],
    }));
  }

  private async loadMoySkladCatalog(
    categories: CategoryGroup[],
    uuid: string,
  ): Promise<void> {
    for (const group of categories) {
      const filter = CATEGORY_MS_FILTER[group.category];
      const rows: { id: string; name: string }[] = [];

      for await (const page of this.moysklad.fetchAssortment(filter)) {
        rows.push(...page);
      }
      await delay(350);
      group.moySkladCatalogRows = rows;
      const msg = `МС [${group.category}]: ${rows.length} товаров`;
      console.log(msg);
      this.progress.emit(uuid, {
        step: 'loadCatalog',
        message: msg,
        status: 'progress',
      });
    }
  }

  private buildMoySkladUpdates(items: MatchedProduct[]) {
    const MS = 'https://api.moysklad.ru/api/remap/1.2/entity';
    const currencyHref = `${MS}/currency/840058f5-7c96-11ee-0a80-14d30012e50a`;
    const buyDateAttrHref = `${MS}/product/metadata/attributes/ca57f589-4af2-11f1-0a80-1053002651f8`;

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 00:00:00`;

    return items
      .filter((item) => item.price != null && item.externalId != null)
      .map((item) => ({
        meta: {
          href: `${MS}/product/${item.externalId}`,
          type: 'product',
          mediaType: 'application/json',
        },
        buyPrice: {
          value: Math.round(parseFloat(String(item.price)) * 100) || 0,
          currency: {
            meta: {
              href: currencyHref,
              type: 'currency',
              mediaType: 'application/json',
            },
          },
        },
        attributes: [
          {
            meta: {
              href: buyDateAttrHref,
              type: 'attributemetadata',
              mediaType: 'application/json',
            },
            value: today,
          },
        ],
      }));
  }

  private async writeResultsToSheet(matched: MatchedProduct[]): Promise<void> {
    const sheetName = await this.sheets.getSheetNameByGid(
      SPREADSHEET_ID,
      SHEET_GID,
    );

    // Читаем только колонку A (externalId) начиная с 5-й строки
    const rows = await this.sheets.getRows(SPREADSHEET_ID, {
      range: `${sheetName}!A5:A`,
    });

    // Строим индекс: externalId → номер строки в таблице
    const idToSheetRow = new Map<string, number>();
    rows.forEach((row, i) => {
      const id = row[0]?.toString().trim();
      if (id) idToSheetRow.set(id, 5 + i);
    });

    // Собираем batch-обновления только для сопоставленных позиций с ценой
    const updates = matched
      .filter((item) => item.price != null && idToSheetRow.has(item.externalId))
      .map((item) => ({
        range: `${sheetName}!AN${idToSheetRow.get(item.externalId)}`,
        values: [[String(item.price)]],
      }));

    if (updates.length === 0) {
      console.log('Нет позиций для обновления в таблице — цены не изменены');
      return;
    }

    // Сброс происходит только если есть что записывать — старые цены не затираются зря
    await this.resetCostsToNull();
    await this.sheets.updateRows(SPREADSHEET_ID, updates);
    console.log(`Обновлено в таблице: ${updates.length} строк`);
  }

  private async matchAllCategories(
    categories: CategoryGroup[],
    uuid: string,
  ): Promise<MatchedProduct[]> {
    const results = await Promise.allSettled(
      categories.map(async (group) => {
        console.log(`[${group.category}] Отправка запроса к AI...`);
        this.progress.emit(uuid, {
          step: 'matchCategories',
          message: `Сопоставление [${group.category}]...`,
          status: 'progress',
        });
        const prompt = buildMatchingPrompt(
          group.category,
          group.priceRows,
          group.moySkladCatalogRows,
        );

        const raw = await this.ai.ask(prompt, {
          temperature: 0,
          maxTokens: 30000,
          stream: true,
          headers: { 'X-OmniRoute-No-Cache': 'true' },
        });

        const matched = parseMatchingResponse(raw, group.category);
        console.log(
          `[${group.category}] Сопоставлено: ${matched.length} позиций`,
        );
        this.progress.emit(uuid, {
          step: 'matchCategories',
          message: `[${group.category}] сопоставлено: ${matched.length} позиций`,
          status: 'progress',
        });
        return matched;
      }),
    );

    return results.flatMap((result, i) => {
      if (result.status === 'fulfilled') return result.value;

      console.error(
        `[${categories[i].category}] Ошибка AI-сопоставления:`,
        result.reason,
      );
      return [];
    });
  }
}

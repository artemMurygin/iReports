import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../../infrustructure/database/database.service';

// Раскрывает фильтр правила магазина по категории до всех потомков дерева
// `MoySkladProductFolder` (issue #50, Фаза 10, см.
// docs/payroll/prd-payroll-calculation.md, раздел "Роли магазина": "категория
// указывается папкой MoySkladProductFolder, под правило попадают все её
// потомки"). Будущий модуль `domains/shop/modules/accounting` (Фаза 12,
// правила `ProductSold` / `UsedProductSold`) превращает выбранную
// руководителем категорию в список folderId этим методом, а не
// переизобретает обход дерева сам — поэтому сервис живёт здесь, рядом с
// остальным Prisma-доступом к `moySklad*`-таблицам (см. shop/CLAUDE.md:
// в домене пока нет ни одного DDD-модуля, заводить новый ради одной этой
// операции — избыточно).
//
// Способ раскрытия (issue #50 допускает оба варианта — выбор
// зафиксирован здесь): один запрос `pathName LIKE 'root.pathName/%'` по
// индексу @@index([pathName], ops: text_pattern_ops) в moySklad.prisma, а
// не рекурсивный обход `parentId`. Рекурсивный обход либо загружает всё
// дерево категорий в память на каждый вызов, либо делает
// O(глубина дерева) последовательных запросов к БД — дерево пополняется
// синком без ограничения глубины, поэтому один индексированный запрос
// надёжнее и не деградирует с ростом справочника.
//
// Формат pathName у МойСклад — путь по именам предков через "/"
// (например "Техника/Смартфоны/iPhone"), поэтому у любого потомка pathName
// начинается с pathName родителя + "/" — сравнение строгое по префиксу, не
// требует нормализации регистра или обрезки пробелов.
@Injectable()
export class ProductFolderTreeService {
    constructor(private readonly db: DatabaseService) {}

    // Возвращает id самой категории и всех её потомков любого уровня
    // вложенности. Для несуществующего folderId — пустой массив (правило
    // не должно молча трактовать это как "все товары").
    async resolveDescendantFolderIds(rootFolderId: string): Promise<string[]> {
        const root = await this.db.moySkladProductFolder.findUnique({
            where: { id: rootFolderId },
            select: { id: true, pathName: true },
        });
        if (!root) return [];

        const descendants = await this.db.moySkladProductFolder.findMany({
            where: { pathName: { startsWith: `${root.pathName}/` } },
            select: { id: true },
        });

        return [root.id, ...descendants.map((d) => d.id)];
    }
}

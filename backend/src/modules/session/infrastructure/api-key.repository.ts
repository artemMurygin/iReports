import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { ApiKey } from '../domain/value-objects/api-key.value-object';

export interface ActiveEmployeeByApiKey {
    employeeId: number;
}

// add-employee-api-key-auth, design.md Decision 3: два точечных метода поверх
// Prisma, прямой доступ к BitrixEmployee.apiKeyHash через собственный
// Prisma-делегат session-модуля — та же таблица, которой для остальных полей
// владеет sync/bitrix (design.md, "Альтернатива (отклонена)": не нарушение
// правила изоляции модулей, а тот же паттерн, что уже применяется для общих
// таблиц service/shop, см. backend/CLAUDE.md). Оба метода read-only/точечный
// update одного поля — без PrismaRepository.write() (нет доменного агрегата
// и событий), тот же приём, что DirectoryRepository.setServiceAccount.
@Injectable()
export class ApiKeyRepository {
    constructor(private readonly db: DatabaseService) {}

    // Используется SessionAuthGuard (design.md Decision 3). spec:
    // auth/api-key — "Ключ уволенного сотрудника перестаёт действовать":
    // isActive: true в where, а не постфильтр — уволенный сотрудник с
    // совпадающим хэшем не должен аутентифицироваться, даже если его
    // apiKeyHash формально ещё не очищен.
    async findActiveEmployeeByApiKeyHash(
        hash: string,
    ): Promise<ActiveEmployeeByApiKey | null> {
        const employee = await this.db.bitrixEmployee.findFirst({
            where: { apiKeyHash: hash, isActive: true },
            select: { id: true },
        });
        return employee ? { employeeId: employee.id } : null;
    }

    // Используется эндпоинтом регенерации (design.md Decision 3). spec:
    // auth/api-key — "Регенерация выдаёт новый ключ и деактивирует старый":
    // apiKeyHash — @unique в схеме, поэтому перезапись значения сама по себе
    // инвалидирует прежний хэш (он больше не встречается ни у одной строки,
    // findActiveEmployeeByApiKeyHash(oldHash) вернёт null); отдельного шага
    // "удалить старое значение" не требуется. Возвращает сырое значение
    // ключа вызывающему — единственный момент, когда оно видимо в открытом
    // виде (design.md Decision 1).
    async regenerateApiKey(employeeId: number): Promise<string> {
        const { value, hash } = ApiKey.generate();
        await this.db.bitrixEmployee.update({
            where: { id: employeeId },
            data: { apiKeyHash: hash },
        });
        return value.unpack();
    }
}

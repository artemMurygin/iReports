import { WorkScheduleEntryRepository } from './work-schedule-entry.repository';
import { WorkScheduleEntry } from '@/modules/work-schedule/domain/entities/work-schedule-entry.entity';
import { ScheduleDate } from '@/modules/work-schedule/domain/value-objects/schedule-date.value-object';
import { WorkDay } from '@/modules/work-schedule/domain/value-objects/work-day.value-object';
import { withRequestContext } from '@/shared/testing/with-request-context';
import type { DatabaseService } from '@/infrustructure/database/database.service';

// update() собирает Prisma `data` вручную, а не через WorkScheduleEntryMapper
// (в отличие от insert()) — при добавлении isOnDuty (docs/work-schedule-duty-mark)
// это поле однажды забыли добавить сюда: PUT возвращал isOnDuty: true из
// in-memory сущности (handler строит ответ через toWorkScheduleEntryResponse
// до похода в БД), но в саму БД уходили только status/hours/role, поэтому
// последующий GET месяца отдавал isOnDuty: false. Мапер (toPersistence) уже
// покрыт своим спеком (work-schedule-entry.mapper.spec.ts) — этот файл
// проверяет именно ФАКТИЧЕСКИЙ объект, переданный в Prisma `update`/`create`,
// чтобы такое расхождение между insert() и update() не повторилось молча.
describe('WorkScheduleEntryRepository', () => {
    const buildEntry = (isOnDuty: boolean) =>
        WorkScheduleEntry.create({
            employeeId: 42,
            date: ScheduleDate.create('2026-08-05'),
            day: WorkDay.create({ status: 'WORKING', hours: 8, isOnDuty }),
        });

    const buildRepository = () => {
        const create = jest.fn();
        const update = jest.fn();
        const client = { workScheduleEntry: { create, update } };
        const db = {
            getClient: () => client,
            // write() делегирует в db.withTransaction — здесь без реальной
            // Prisma-транзакции, просто выполняет колбэк (тот же приём, что
            // и в erp-cash-document.repository.spec.ts).
            withTransaction: (callback: () => Promise<unknown>) => callback(),
        } as unknown as DatabaseService;

        return {
            repository: new WorkScheduleEntryRepository(db),
            create,
            update,
        };
    };

    describe('update', () => {
        it('передаёт isOnDuty: true в Prisma наравне со status/hours/role', async () => {
            const { repository, update } = buildRepository();
            update.mockResolvedValueOnce({});
            const entry = buildEntry(true);

            await withRequestContext(() => repository.update(entry));

            expect(update).toHaveBeenCalledTimes(1);
            expect(update).toHaveBeenCalledWith({
                where: { id: entry.id },
                data: expect.objectContaining({
                    status: 'WORKING',
                    hours: 8,
                    role: null,
                    isOnDuty: true,
                }) as unknown,
            });
        });

        it('снятие дежурства (isOnDuty: false) тоже доходит до Prisma, а не пропускается как falsy', async () => {
            const { repository, update } = buildRepository();
            update.mockResolvedValueOnce({});
            const entry = buildEntry(false);

            await withRequestContext(() => repository.update(entry));

            expect(update).toHaveBeenCalledWith({
                where: { id: entry.id },
                data: expect.objectContaining({ isOnDuty: false }) as unknown,
            });
        });
    });

    describe('insert', () => {
        it('передаёт isOnDuty через toPersistence при создании новой записи', async () => {
            const { repository, create } = buildRepository();
            create.mockResolvedValueOnce({});
            const entry = buildEntry(true);

            await withRequestContext(() => repository.insert(entry));

            expect(create).toHaveBeenCalledWith({
                data: expect.objectContaining({ isOnDuty: true }) as unknown,
            });
        });
    });
});

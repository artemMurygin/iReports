import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TaskCompletionsService } from './task-completions.service';
import { DatabaseService } from '../../database/database.service';

describe('TaskCompletionsService', () => {
  let service: TaskCompletionsService;
  const db = {
    taskCompletion: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskCompletionsService,
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();
    service = module.get<TaskCompletionsService>(TaskCompletionsService);
  });

  it('update: 404 для несуществующей записи', async () => {
    db.taskCompletion.findUnique.mockResolvedValue(null);
    await expect(service.update(404, { completed: true })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('update: при отметке "выполнено" проставляет completedAt', async () => {
    db.taskCompletion.findUnique.mockResolvedValue({
      id: 1,
      approvedById: null,
    });
    let capturedCall:
      | {
          where: { id: number };
          data: {
            completed: boolean;
            approvedById: number | null;
            completedAt: Date | null;
          };
        }
      | undefined;
    db.taskCompletion.update.mockImplementation(
      (args: {
        where: { id: number };
        data: {
          completed: boolean;
          approvedById: number | null;
          completedAt: Date | null;
        };
      }) => {
        capturedCall = args;
        return Promise.resolve({ id: 1, completed: true });
      },
    );

    await service.update(1, { completed: true, approvedById: 7 });

    expect(capturedCall?.where).toEqual({ id: 1 });
    expect(capturedCall?.data.completed).toBe(true);
    expect(capturedCall?.data.approvedById).toBe(7);
    expect(capturedCall?.data.completedAt).toBeInstanceOf(Date);
  });

  it('update: при снятии отметки очищает completedAt', async () => {
    db.taskCompletion.findUnique.mockResolvedValue({ id: 1, approvedById: 7 });
    db.taskCompletion.update.mockResolvedValue({ id: 1, completed: false });

    await service.update(1, { completed: false });

    expect(db.taskCompletion.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { completed: false, completedAt: null, approvedById: 7 },
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { RoappSyncService } from './roapp.service';
import { DatabaseService } from '../../database/database.service';
import { RoappService } from '../../integrations/roapp/roapp.service';
import { CustomApiRoappService } from '../../integrations/custom-api-roapp/custom-api-roapp.service';

jest.mock('../../utils/logger', () => ({
  UploadLogger: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    tick: jest.fn(),
    done: jest.fn(),
    error: jest.fn(),
  })),
}));

async function* asyncGen<T>(batches: T[]) {
  for (const batch of batches) {
    yield batch;
  }
}

describe('RoappSyncService', () => {
  let service: RoappSyncService;
  let db: {
    roappEmployee: { upsert: jest.Mock };
    roappOrderStatus: { upsert: jest.Mock };
    roappOrderType: { upsert: jest.Mock };
    roappMarketingSource: { upsert: jest.Mock };
    roappServiceCategory: { upsert: jest.Mock; findMany: jest.Mock };
    roappProductCategory: { upsert: jest.Mock };
    roappService: { upsert: jest.Mock; findMany: jest.Mock };
    roappProduct: { upsert: jest.Mock };
    roappOrder: { upsert: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    roappProductsOrder: { deleteMany: jest.Mock; createMany: jest.Mock };
    roappServiceOrder: { deleteMany: jest.Mock; createMany: jest.Mock };
  };
  let roapp: {
    fetchEmployees: jest.Mock;
    fetchOrderStatuses: jest.Mock;
    fetchOrderTypes: jest.Mock;
    fetchMarketingSources: jest.Mock;
    fetchServicesCategories: jest.Mock;
    fetchProductsCategories: jest.Mock;
    fetchServices: jest.Mock;
    fetchProducts: jest.Mock;
    fetchCreatedOrders: jest.Mock;
    fetchUpdatedOrders: jest.Mock;
    fetchOrderItems: jest.Mock;
  };
  let customApiRoapp: {
    getServiceBonusById: jest.Mock;
  };

  beforeEach(async () => {
    db = {
      roappEmployee: { upsert: jest.fn().mockResolvedValue({}) },
      roappOrderStatus: { upsert: jest.fn().mockResolvedValue({}) },
      roappOrderType: { upsert: jest.fn().mockResolvedValue({}) },
      roappMarketingSource: { upsert: jest.fn().mockResolvedValue({}) },
      roappServiceCategory: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      roappProductCategory: { upsert: jest.fn().mockResolvedValue({}) },
      roappService: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      roappProduct: { upsert: jest.fn().mockResolvedValue({}) },
      roappOrder: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      roappProductsOrder: {
        deleteMany: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({}),
      },
      roappServiceOrder: {
        deleteMany: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({}),
      },
    };
    roapp = {
      fetchEmployees: jest.fn(),
      fetchOrderStatuses: jest.fn(),
      fetchOrderTypes: jest.fn(),
      fetchMarketingSources: jest.fn(),
      fetchServicesCategories: jest.fn(),
      fetchProductsCategories: jest.fn(),
      fetchServices: jest.fn(),
      fetchProducts: jest.fn(),
      fetchCreatedOrders: jest.fn(),
      fetchUpdatedOrders: jest.fn(),
      fetchOrderItems: jest.fn(),
    };
    customApiRoapp = {
      getServiceBonusById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoappSyncService,
        { provide: DatabaseService, useValue: db },
        { provide: RoappService, useValue: roapp },
        { provide: CustomApiRoappService, useValue: customApiRoapp },
      ],
    }).compile();

    service = module.get<RoappSyncService>(RoappSyncService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadEmployees', () => {
    it('сохраняет всех сотрудников и возвращает их количество', async () => {
      roapp.fetchEmployees.mockResolvedValue([
        { id: 1, first_name: 'Иван', last_name: 'Иванов' },
        { id: 2, first_name: 'Пётр', last_name: 'Петров' },
      ]);

      const result = await service.uploadEmployees();

      expect(result).toBe(2);
      expect(db.roappEmployee.upsert).toHaveBeenCalledTimes(2);
      expect(db.roappEmployee.upsert).toHaveBeenCalledWith({
        where: { id: 1 },
        create: { id: 1, firstName: 'Иван', lastName: 'Иванов' },
        update: { firstName: 'Иван', lastName: 'Иванов' },
      });
    });

    it('оборачивает ошибку в InternalServerErrorException', async () => {
      roapp.fetchEmployees.mockRejectedValue(new Error('network down'));

      await expect(service.uploadEmployees()).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.uploadEmployees()).rejects.toThrow(
        /network down/,
      );
    });
  });

  describe('uploadOrderStatuses', () => {
    it('сохраняет статусы заказов и возвращает их количество', async () => {
      roapp.fetchOrderStatuses.mockResolvedValue([
        { id: 1, name: 'Новый', color: '#fff', group: 'open' },
      ]);

      const result = await service.uploadOrderStatuses();

      expect(result).toBe(1);
      expect(db.roappOrderStatus.upsert).toHaveBeenCalledWith({
        where: { id: 1 },
        create: { id: 1, name: 'Новый', color: '#fff', grupName: 'open' },
        update: { name: 'Новый', color: '#fff', grupName: 'open' },
      });
    });

    it('оборачивает ошибку в InternalServerErrorException', async () => {
      roapp.fetchOrderStatuses.mockRejectedValue(new Error('boom'));

      await expect(service.uploadOrderStatuses()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('uploadOrderTypes', () => {
    it('сохраняет типы заказов и возвращает их количество', async () => {
      roapp.fetchOrderTypes.mockResolvedValue([{ id: 5, title: 'Гарантия' }]);

      const result = await service.uploadOrderTypes();

      expect(result).toBe(1);
      expect(db.roappOrderType.upsert).toHaveBeenCalledWith({
        where: { id: 5 },
        create: { id: 5, name: 'Гарантия' },
        update: { name: 'Гарантия' },
      });
    });

    it('оборачивает ошибку в InternalServerErrorException', async () => {
      roapp.fetchOrderTypes.mockRejectedValue(new Error('boom'));

      await expect(service.uploadOrderTypes()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('uploadMarketingSources', () => {
    it('сохраняет маркетинговые источники и возвращает их количество', async () => {
      roapp.fetchMarketingSources.mockResolvedValue([{ id: 7, name: 'Avito' }]);

      const result = await service.uploadMarketingSources();

      expect(result).toBe(1);
      expect(db.roappMarketingSource.upsert).toHaveBeenCalledWith({
        where: { id: 7 },
        create: { id: 7, name: 'Avito' },
        update: { name: 'Avito' },
      });
    });

    it('оборачивает ошибку в InternalServerErrorException', async () => {
      roapp.fetchMarketingSources.mockRejectedValue(new Error('boom'));

      await expect(service.uploadMarketingSources()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('uploadServiceCategories', () => {
    it('сортирует категории так, чтобы родители сохранялись раньше детей', async () => {
      // Дочерняя категория идёт в потоке раньше родительской —
      // topoSort должен переставить их перед сохранением.
      roapp.fetchServicesCategories.mockReturnValue(
        asyncGen([
          [{ id: 2, title: 'Брэнд', parent_id: 1 }],
          [{ id: 1, title: 'Тип работ', parent_id: null }],
        ]),
      );

      await service.uploadServiceCategories();

      const order = db.roappServiceCategory.upsert.mock.calls.map(
        ([arg]) => arg.where.id,
      );
      expect(order).toEqual([1, 2]);
      expect(db.roappServiceCategory.upsert).toHaveBeenNthCalledWith(2, {
        where: { id: 2 },
        create: { id: 2, name: 'Брэнд', parentId: 1 },
        update: { name: 'Брэнд', parentId: 1 },
      });
    });

    it('логирует ошибку и пробрасывает её дальше', async () => {
      const error = new Error('fetch failed');
      roapp.fetchServicesCategories.mockImplementation(async function* () {
        throw error;
      });

      await expect(service.uploadServiceCategories()).rejects.toThrow(error);
      expect(db.roappServiceCategory.upsert).not.toHaveBeenCalled();
    });
  });

  describe('uploadProductCategories', () => {
    it('сортирует и сохраняет категории продуктов', async () => {
      roapp.fetchProductsCategories.mockReturnValue(
        asyncGen([[{ id: 1, title: 'Аксессуары', parent_id: null }]]),
      );

      await service.uploadProductCategories();

      expect(db.roappProductCategory.upsert).toHaveBeenCalledWith({
        where: { id: 1 },
        create: { id: 1, name: 'Аксессуары', parentId: null },
        update: { name: 'Аксессуары', parentId: null },
      });
    });

    it('логирует ошибку и пробрасывает её дальше', async () => {
      const error = new Error('fetch failed');
      roapp.fetchProductsCategories.mockImplementation(async function* () {
        throw error;
      });

      await expect(service.uploadProductCategories()).rejects.toThrow(error);
    });
  });

  describe('uploadServices', () => {
    it('раскладывает услугу по уровням дерева категорий', async () => {
      // Дерево: 100 (корень, не используется) -> 1 (workType) -> 2 (brand) -> 3 (device)
      db.roappServiceCategory.findMany.mockResolvedValue([
        { id: 100, parentId: null },
        { id: 1, parentId: 100 },
        { id: 2, parentId: 1 },
        { id: 3, parentId: 2 },
      ]);
      roapp.fetchServices.mockReturnValue(
        asyncGen([
          [
            {
              id: 10,
              name: 'Замена экрана',
              price: 1000,
              warranty: 30,
              duration: 60,
              categoryId: 3,
            },
          ],
        ]),
      );

      await service.uploadServices();

      expect(db.roappService.upsert).toHaveBeenCalledWith({
        where: { id: 10 },
        create: {
          id: 10,
          name: 'Замена экрана',
          engeneerBonus: 10,
          price: 1000,
          warranty: 30,
          duration: 60,
          inCatalog: true,
          categoryId: 3,
          workTypeId: 1,
          brandId: 2,
          deviceId: 3,
          serviceTypeId: null,
          seriesId: null,
        },
        update: {
          categoryId: 3,
          workTypeId: 1,
          brandId: 2,
          deviceId: 3,
          serviceTypeId: null,
          seriesId: null,
        },
      });
    });

    it('сохраняет null-предков, если у услуги нет категории', async () => {
      db.roappServiceCategory.findMany.mockResolvedValue([]);
      roapp.fetchServices.mockReturnValue(
        asyncGen([
          [
            {
              id: 11,
              name: 'Диагностика',
              price: 0,
              warranty: 0,
              duration: 15,
              categoryId: null,
            },
          ],
        ]),
      );

      await service.uploadServices();

      expect(db.roappService.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            workTypeId: null,
            brandId: null,
            deviceId: null,
            serviceTypeId: null,
            seriesId: null,
          }),
        }),
      );
    });

    it('логирует ошибку и пробрасывает её дальше', async () => {
      const error = new Error('fetch failed');
      db.roappServiceCategory.findMany.mockResolvedValue([]);
      roapp.fetchServices.mockImplementation(async function* () {
        throw error;
      });

      await expect(service.uploadServices()).rejects.toThrow(error);
    });
  });

  describe('uploadProducts', () => {
    it('сохраняет продукты постранично', async () => {
      roapp.fetchProducts.mockReturnValue(
        asyncGen([
          [
            {
              id: 20,
              name: 'Чехол',
              engeneerBonus: 0,
              price: 500,
              categoryId: 9,
            },
          ],
        ]),
      );

      await service.uploadProducts();

      expect(db.roappProduct.upsert).toHaveBeenCalledWith({
        where: { id: 20 },
        create: {
          id: 20,
          name: 'Чехол',
          engeneerBonus: 0,
          price: 500,
          categoryId: 9,
        },
        update: {
          name: 'Чехол',
          engeneerBonus: 0,
          price: 500,
          categoryId: 9,
        },
      });
    });

    it('логирует ошибку и пробрасывает её дальше', async () => {
      const error = new Error('fetch failed');
      roapp.fetchProducts.mockImplementation(async function* () {
        throw error;
      });

      await expect(service.uploadProducts()).rejects.toThrow(error);
    });
  });

  // OrderSchema уже привёл числа/даты к нужным типам — здесь мок отражает то,
  // что реально возвращает Roapp.fetchCreatedOrders/fetchUpdatedOrders
  const parsedOrder = {
    id: 30,
    label: 'Заказ №30',
    bitrixDealId: 123,
    clientId: 5,
    statusId: 1,
    managerId: 2,
    createdById: 3,
    closedById: null,
    orderTypeId: 4,
    marketingSource: null,
    malfunction: 'Не включается',
    discountSum: 0,
    payed: 500,
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 12',
    deviceSerial: null,
    deviceColor: null,
    failReason: null,
    serviceSupplierName: null,
    onlineManager: null,
    dueDate: new Date('2025-01-10'),
    doneAt: null,
    closedAt: null,
    modifiedAt: new Date('2025-01-05T10:00:00Z'),
    createdAt: new Date('2025-01-01T10:00:00Z'),
  };

  const { id: _orderId, ...expectedOrderFields } = parsedOrder;

  describe('uploadCreatedOrders', () => {
    it('сохраняет заказы постранично', async () => {
      roapp.fetchCreatedOrders.mockReturnValue(asyncGen([[parsedOrder]]));

      await service.uploadCreatedOrders();

      expect(roapp.fetchCreatedOrders).toHaveBeenCalledWith(
        undefined,
        'created',
      );
      expect(db.roappOrder.upsert).toHaveBeenCalledWith({
        where: { id: 30 },
        create: { id: 30, ...expectedOrderFields },
        update: expectedOrderFields,
      });
    });

    it('логирует ошибку и пробрасывает её дальше', async () => {
      const error = new Error('fetch failed');
      roapp.fetchCreatedOrders.mockImplementation(async function* () {
        throw error;
      });

      await expect(service.uploadCreatedOrders()).rejects.toThrow(error);
    });
  });

  describe('uploadUpdatedOrders', () => {
    it('сохраняет заказы постранично', async () => {
      roapp.fetchUpdatedOrders.mockReturnValue(asyncGen([[parsedOrder]]));
      const fromDate = new Date('2025-01-01');

      await service.uploadUpdatedOrders(fromDate);

      expect(roapp.fetchUpdatedOrders).toHaveBeenCalledWith(
        fromDate,
        'updated',
      );
      expect(db.roappOrder.upsert).toHaveBeenCalledWith({
        where: { id: 30 },
        create: { id: 30, ...expectedOrderFields },
        update: expectedOrderFields,
      });
    });

    it('логирует ошибку и пробрасывает её дальше', async () => {
      const error = new Error('fetch failed');
      roapp.fetchUpdatedOrders.mockImplementation(async function* () {
        throw error;
      });

      await expect(service.uploadUpdatedOrders()).rejects.toThrow(error);
    });
  });

  describe('uploadOrderItems', () => {
    const productItem = {
      id: 1,
      productId: 9,
      quantity: 2,
      price: 50,
      cost: 100,
      discount: 0,
      engineerId: 3,
    };
    const serviceItem = {
      id: 2,
      serviceId: 5,
      quantity: 1,
      price: 300,
      cost: 0,
      discount: 0,
      inCatalog: true,
      engineerId: 3,
    };

    it('без аргумента берёт все заказы из БД, пишет позиции и считает cost/engineerSalary/managerSalary', async () => {
      db.roappOrder.findMany.mockResolvedValue([{ id: 30, payed: 1000 }]);
      db.roappService.findMany.mockResolvedValue([
        { id: 5, engeneerBonus: 50 },
      ]);
      roapp.fetchOrderItems.mockResolvedValue([productItem, serviceItem]);

      await service.uploadOrderItems();

      expect(roapp.fetchOrderItems).toHaveBeenCalledWith(30);
      expect(db.roappProductsOrder.deleteMany).toHaveBeenCalledWith({
        where: { orderId: 30 },
      });
      expect(db.roappServiceOrder.deleteMany).toHaveBeenCalledWith({
        where: { orderId: 30 },
      });
      expect(db.roappProductsOrder.createMany).toHaveBeenCalledWith({
        data: [
          {
            orderId: 30,
            productId: 9,
            quantity: 2,
            price: 50,
            cost: 100,
            engineerId: 3,
          },
        ],
      });
      expect(db.roappServiceOrder.createMany).toHaveBeenCalledWith({
        data: [
          {
            orderId: 30,
            serviceId: 5,
            quantity: 1,
            price: 300,
            cost: 0,
            discount: 0,
            inCatalog: true,
            engineerId: 3,
            engeneerSalary: 50,
          },
        ],
      });
      // cost = 100 * 2 = 200; engineerSalary = 50 * 1 = 50;
      // managerSalary = round(0.1 * (1000 - 200 - 50)) = 75
      expect(db.roappOrder.update).toHaveBeenCalledWith({
        where: { id: 30 },
        data: { cost: 200, engineerSalary: 50, managerSalary: 75 },
      });
    });

    it('услуга без записи в каталоге даёт бонус 0', async () => {
      db.roappOrder.findMany.mockResolvedValue([{ id: 31, payed: 100 }]);
      db.roappService.findMany.mockResolvedValue([]);
      roapp.fetchOrderItems.mockResolvedValue([serviceItem]);

      await service.uploadOrderItems();

      expect(db.roappServiceOrder.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ engeneerSalary: 0 })],
      });
      expect(db.roappOrder.update).toHaveBeenCalledWith({
        where: { id: 31 },
        data: { cost: 0, engineerSalary: 0, managerSalary: 10 },
      });
    });

    it('с переданными orderIds фильтрует findMany по id: { in: orderIds }', async () => {
      db.roappOrder.findMany.mockResolvedValue([{ id: 32, payed: 0 }]);
      db.roappService.findMany.mockResolvedValue([]);
      roapp.fetchOrderItems.mockResolvedValue([]);

      await service.uploadOrderItems([32]);

      expect(db.roappOrder.findMany).toHaveBeenCalledWith({
        where: { id: { in: [32] } },
        select: { id: true, payed: true },
      });
    });

    it('логирует ошибку и пробрасывает её дальше', async () => {
      const error = new Error('fetch failed');
      db.roappOrder.findMany.mockResolvedValue([{ id: 33, payed: 0 }]);
      db.roappService.findMany.mockResolvedValue([]);
      roapp.fetchOrderItems.mockRejectedValue(error);

      await expect(service.uploadOrderItems()).rejects.toThrow(error);
    });
  });
});
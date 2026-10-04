import { AxiosError } from 'axios';
import { BadGatewayException } from '@nestjs/common';
import { CustomApiRoappService } from './custom-api-roapp.service';
import type { CustomApiRoappHttpService } from './custom-api-roapp.instance';

// НЕ реальные вызовы rm.murygin.tech — HTTP-клиент замокан целиком
// (post — jest.fn()), см. warehouse-api-finding.md (задача 1.2 change
// service-turnover-report) про сетевую недоступность хоста из этого
// окружения.
describe('CustomApiRoappService.getGoodsFlowReport', () => {
    let post: jest.Mock;
    let service: CustomApiRoappService;

    beforeEach(() => {
        post = jest.fn();
        const customApiRoapp = {
            instance: { post },
        } as unknown as CustomApiRoappHttpService;
        service = new CustomApiRoappService(customApiRoapp);
    });

    const payload = {
        startDate: 1735689600000,
        endDate: 1738368000000,
        category_id: 1,
        warehouses: [1],
    };

    it('отправляет payload {startDate, endDate, category_id, warehouses} на /getGoodsFlowReport', async () => {
        post.mockResolvedValueOnce({
            data: {
                outcome: { quantity: 3, sum: 1500 },
                stock: { quantity: 10, sum: 5000 },
            },
        });

        await service.getGoodsFlowReport(payload);

        expect(post).toHaveBeenCalledWith('/getGoodsFlowReport', payload);
    });

    it('возвращает распарсенный ответ {outcome:{quantity,sum}, stock:{quantity,sum}}', async () => {
        post.mockResolvedValueOnce({
            data: {
                outcome: { quantity: 3, sum: 1500 },
                stock: { quantity: 10, sum: 5000 },
            },
        });

        const result = await service.getGoodsFlowReport(payload);

        expect(result).toEqual({
            outcome: { quantity: 3, sum: 1500 },
            stock: { quantity: 10, sum: 5000 },
        });
    });

    it('округляет дробную сумму (RoApp отдаёт с копейками) до целых рублей', async () => {
        post.mockResolvedValueOnce({
            data: {
                outcome: { quantity: 3, sum: 11943.2 },
                stock: { quantity: 10, sum: 21611.32682 },
            },
        });

        const result = await service.getGoodsFlowReport(payload);

        expect(result).toEqual({
            outcome: { quantity: 3, sum: 11943 },
            stock: { quantity: 10, sum: 21611 },
        });
    });

    it('ответ, не проходящий Zod-валидацию, -> BadGatewayException', async () => {
        post.mockResolvedValueOnce({
            data: {
                outcome: { quantity: 3 },
                stock: { quantity: 10, sum: 5000 },
            },
        });

        const error = await service
            .getGoodsFlowReport(payload)
            .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(BadGatewayException);
    });

    it('сбой HTTP-вызова -> BadGatewayException', async () => {
        post.mockRejectedValueOnce(new Error('502 Bad Gateway'));

        const error = await service
            .getGoodsFlowReport(payload)
            .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(BadGatewayException);
    });
});

// Сервис CustomApiRoapp при ошибках валидации файла отвечает 422 с полем message
// («Файл содержит ошибки (N шт.), импорт отменён: ...») — это сообщение должно
// дойти до клиента (Google Таблица) как есть, а не общим текстом axios.
describe('CustomApiRoappService.updateServices', () => {
    let post: jest.Mock;
    let service: CustomApiRoappService;

    beforeEach(() => {
        post = jest.fn();
        const customApiRoapp = {
            instance: { post },
        } as unknown as CustomApiRoappHttpService;
        service = new CustomApiRoappService(customApiRoapp);
    });

    const remoteMessage =
        'Файл содержит ошибки (1 шт.), импорт отменён:\nДублирующиеся строки:\n  • Замена дисплея iPad Air 1- 2014';

    it('422 с полем message -> BadGatewayException с текстом удалённого сервиса', async () => {
        post.mockRejectedValueOnce(
            new AxiosError(
                'Request failed with status code 422',
                '422',
                undefined,
                undefined,
                {
                    status: 422,
                    data: { message: remoteMessage },
                } as never,
            ),
        );

        const error: unknown = await service
            .updateServices(Buffer.from('x'))
            .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(BadGatewayException);
        expect((error as Error).message).toBe(remoteMessage);
    });

    it('422 с полем error вместо message -> тоже отдаёт текст удалённого сервиса', async () => {
        post.mockRejectedValueOnce(
            new AxiosError(
                'Request failed with status code 422',
                '422',
                undefined,
                undefined,
                {
                    status: 422,
                    data: { error: remoteMessage },
                } as never,
            ),
        );

        await expect(service.updateServices(Buffer.from('x'))).rejects.toThrow(
            remoteMessage,
        );
    });
});

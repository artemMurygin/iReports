import {
    BadGatewayException,
    BadRequestException,
    Injectable,
} from '@nestjs/common';
import axios from 'axios';
import {
    ServiceBonusForEngeneer,
    ServiceBonusForEngeneerSchema,
} from './schemas/serviceBonusForEngeneer.schema';
import {
    ServiceBonusById,
    ServiceBonusByIdSchema,
} from './schemas/serviceBonusById.schema';
import { CustomApiRoappHttpService } from './custom-api-roapp.instance';
import {
    UpdateServicesResponse,
    UpdateServicesResponseSchema,
} from './schemas/updateServices.schema';
import {
    CreateServiceRequest,
    CreateServiceRequestSchema,
    CreateServiceResponse,
    CreateServiceResponseSchema,
} from './schemas/createService.schema';
import {
    GoodsFlowReportRequest,
    GoodsFlowReportResponse,
    GoodsFlowReportResponseSchema,
} from './schemas/goodsFlowReport.schema';

/**
 * TODO: заменить на Zod-схему конверта ошибки CustomApiRoapp.
 * Поле сообщения непоследовательно между эндпоинтами: /getServicesBonuses/:id
 * отдаёт { message }, а /updateServices — { error } (см.
 * extractRemoteErrorMessage), поэтому оба варианта опциональны.
 */
interface CustomApiRoappErrorEnvelope {
    message?: string;
    error?: string;
}

@Injectable()
export class CustomApiRoappService {
    constructor(private customApiRoapp: CustomApiRoappHttpService) {}

    async getServiceBonusesForEngeneers(): Promise<ServiceBonusForEngeneer[]> {
        try {
            const { data } = await this.customApiRoapp.instance.get<unknown[]>(
                '/getServicesBonuses',
            );
            return data.map((service) =>
                ServiceBonusForEngeneerSchema.parse(service),
            );
        } catch (error) {
            throw new BadGatewayException(
                `Failed to fetch sources from CustomApiRoapp: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async getServiceBonusById(id: number): Promise<ServiceBonusById | null> {
        try {
            const { data } = await this.customApiRoapp.instance.get<unknown>(
                `/getServicesBonuses/${id}`,
            );
            if ((data as CustomApiRoappErrorEnvelope)?.message) {
                return null;
            }
            return ServiceBonusByIdSchema.parse(data);
        } catch (error) {
            throw new BadGatewayException(
                `Failed to fetch service bonus by id from CustomApiRoapp: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async updateServices(file: Buffer): Promise<UpdateServicesResponse> {
        try {
            const formData = new FormData();
            formData.append(
                'file',
                new Blob([new Uint8Array(file)], {
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                }),
                'services.xlsx',
            );

            const { data } = await this.customApiRoapp.instance.post<unknown>(
                '/updateServices',
                formData,
            );
            return UpdateServicesResponseSchema.parse(data);
        } catch (error) {
            throw new BadGatewayException(
                this.extractRemoteErrorMessage(
                    error,
                    'Failed to update services in CustomApiRoapp',
                ),
            );
        }
    }

    async createService(body: unknown): Promise<CreateServiceResponse> {
        let payload: CreateServiceRequest;
        try {
            payload = CreateServiceRequestSchema.parse(body);
        } catch (error) {
            throw new BadRequestException(
                error instanceof Error ? error.message : String(error),
            );
        }

        try {
            const { data } = await this.customApiRoapp.instance.post<unknown>(
                '/createService',
                payload,
            );
            return CreateServiceResponseSchema.parse(data);
        } catch (error) {
            throw new BadGatewayException(
                `Failed to create service in CustomApiRoapp: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Расход/остаток товара за период по одной категории и набору складов
     * (spec: service/goods-turnover). Один вызов = один срез
     * "категория × набор складов" — design.md D2/D4 change
     * service-turnover-report.
     */
    async getGoodsFlowReport(
        payload: GoodsFlowReportRequest,
    ): Promise<GoodsFlowReportResponse> {
        try {
            const { data } = await this.customApiRoapp.instance.post<unknown>(
                '/getGoodsFlowReport',
                payload,
            );
            return GoodsFlowReportResponseSchema.parse(data);
        } catch (error) {
            throw new BadGatewayException(
                `Failed to fetch goods flow report from CustomApiRoapp: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    // При ошибке ответа CustomApiRoapp (не сетевой сбой, а тело с
    // { message } или { error }) фронт должен увидеть именно это сообщение,
    // а не общий текст ошибки axios — см. BadGatewayException выше.
    private extractRemoteErrorMessage(
        error: unknown,
        fallbackPrefix: string,
    ): string {
        if (axios.isAxiosError(error)) {
            const body = error.response?.data as
                | CustomApiRoappErrorEnvelope
                | undefined;
            const remoteMessage = body?.message ?? body?.error;
            if (remoteMessage) return remoteMessage;
        }
        return `${fallbackPrefix}: ${error instanceof Error ? error.message : String(error)}`;
    }
}

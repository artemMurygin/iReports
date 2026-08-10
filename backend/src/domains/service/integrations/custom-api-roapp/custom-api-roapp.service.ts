import {
    BadGatewayException,
    BadRequestException,
    Injectable,
} from '@nestjs/common';
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

@Injectable()
export class CustomApiRoappService {
    constructor(private customApiRoapp: CustomApiRoappHttpService) {}

    async getServiceBonusesForEngeneers(): Promise<ServiceBonusForEngeneer[]> {
        try {
            const { data } = await this.customApiRoapp.instance.get(
                '/getServicesBonuses',
            );
            return data.map((service: unknown) =>
                ServiceBonusForEngeneerSchema.parse(service),
            );
        } catch (error) {
            throw new BadGatewayException(
                `Failed to fetch sources from CustomApiRoapp: ${error.message}`,
            );
        }
    }

    async getServiceBonusById(id: number): Promise<ServiceBonusById | null> {
        try {
            const { data } = await this.customApiRoapp.instance.get(
                `/getServicesBonuses/${id}`,
            );
            if (data?.message) {
                return null;
            }
            return ServiceBonusByIdSchema.parse(data);
        } catch (error) {
            throw new BadGatewayException(
                `Failed to fetch service bonus by id from CustomApiRoapp: ${error.message}`,
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

            const { data } = await this.customApiRoapp.instance.post(
                '/updateServices',
                formData,
            );
            return UpdateServicesResponseSchema.parse(data);
        } catch (error) {
            throw new BadGatewayException(
                `Failed to update services in CustomApiRoapp: ${error.message}`,
            );
        }
    }

    async createService(body: unknown): Promise<CreateServiceResponse> {
        let payload: CreateServiceRequest;
        try {
            payload = CreateServiceRequestSchema.parse(body);
        } catch (error) {
            throw new BadRequestException(error.message);
        }

        try {
            const { data } = await this.customApiRoapp.instance.post(
                '/createService',
                payload,
            );
            return CreateServiceResponseSchema.parse(data);
        } catch (error) {
            throw new BadGatewayException(
                `Failed to create service in CustomApiRoapp: ${error.message}`,
            );
        }
    }
}

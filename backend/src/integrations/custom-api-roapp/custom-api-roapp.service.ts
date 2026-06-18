import { BadGatewayException, Injectable } from '@nestjs/common';
import {
  ServiceBonus,
  ServiceBonuses,
  serviceBonusesForEngeneersSchema,
} from './dto/fetchServiceBonusesForEngeneers-custom-api-roapp.dto';
import { CustomApiRoappHttpService } from './custom-api-roapp.instance';
import {
  UpdateServicesResponse,
  updateServicesResponseSchema,
} from './dto/updateServices-custom-api-roapp.dto';

@Injectable()
export class CustomApiRoappService {
  constructor(private customApiRoapp: CustomApiRoappHttpService) {}

  async fetchServicesBonusesForEngeneers(): Promise<ServiceBonus[]> {
    try {
      const { data } = await this.customApiRoapp.instance.get(
        '/getServicesBonuses',
      );
      return data.map((service: unknown) =>
        serviceBonusesForEngeneersSchema.parse(service),
      );
    } catch (error) {
      throw new BadGatewayException(
        `Failed to fetch sources from CustomApiRoapp: ${error.message}`,
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
      return updateServicesResponseSchema.parse(data);
    } catch (error) {
      throw new BadGatewayException(
        `Failed to update services in CustomApiRoapp: ${error.message}`,
      );
    }
  }
}

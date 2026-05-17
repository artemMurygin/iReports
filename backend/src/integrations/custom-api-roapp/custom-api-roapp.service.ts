import { BadGatewayException, Injectable } from '@nestjs/common';
import {
  ServiceBonus,
  ServiceBonuses,
  serviceBonusesForEngeneersSchema,
} from './dto/fetchServiceBonusesForEngeneers-custom-api-roapp.dto';
import { CustomApiRoappHttpService } from './custom-api-roapp.instance';

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
}

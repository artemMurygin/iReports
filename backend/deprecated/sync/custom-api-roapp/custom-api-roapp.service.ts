import { Injectable } from '@nestjs/common';
import { CustomApiRoappService } from '../../integrations/custom-api-roapp/custom-api-roapp.service';
import { UploadLogger } from '../../utils/logger';
import { DatabaseService } from '../../database/database.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class CustomApiRoappSyncService {
  constructor(
    private readonly CustomApiRoapp: CustomApiRoappService,
    private readonly DB: DatabaseService,
  ) {}

  async uploadServicesBonuses() {
    const log = new UploadLogger('Обновляю начисление в услугах');
    log.start();
    try {
      const bonuses =
        await this.CustomApiRoapp.getServiceBonusesForEngeneers();
      fs.writeFileSync(
        path.join(__dirname, 'bonusLog.json'),
        JSON.stringify(bonuses, null, 2),
        'utf-8',
      );
      for await (let bonus of bonuses) {
        log.tick(1);
        const { id, bonus: engeneerBonus } = bonus;
        await this.DB.roappService.update({
          where: { id },
          data: { engeneerBonus },
        });
      }
      log.done();
    } catch (error) {
      log.error(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}

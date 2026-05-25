import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
import { DatabaseService } from '../../database/database.service';
import { BitrixInstallDto } from './dto/bitrix-install.dto';

@Injectable()
export class BitrixAuthService {
  constructor(private readonly db: DatabaseService) {}

  async saveInstallation(body: BitrixInstallDto): Promise<void> {
    const expiresAt = new Date(Date.now() + Number(body.AUTH_EXPIRES) * 1000);
    const domain = 'irepair.bitrix24.ru';
    const clientEndpoint = `https://${domain}/rest/`;
    const serverEndpoint = 'https://oauth.bitrix.info/rest/';

    await this.db.bitrixInstallation.upsert({
      where: { memberId: body.member_id },
      create: {
        memberId: body.member_id,
        domain,
        accessToken: body.AUTH_ID,
        refreshToken: body.REFRESH_ID,
        clientEndpoint,
        serverEndpoint,
        accessExpiresAt: expiresAt,
      },
      update: {
        domain,
        accessToken: body.AUTH_ID,
        refreshToken: body.REFRESH_ID,
        clientEndpoint,
        accessExpiresAt: expiresAt,
      },
    });
  }

  async getValidAccessToken(memberId: string): Promise<string> {
    const installation = await this.db.bitrixInstallation.findUnique({
      where: { memberId },
    });

    if (!installation) {
      throw new NotFoundException(
        `Установка Bitrix24 для портала ${memberId} не найдена`,
      );
    }

    const isExpired = installation.accessExpiresAt < new Date();
    if (!isExpired) {
      return installation.accessToken;
    }

    return this.refreshTokens(memberId);
  }

  async refreshTokens(memberId: string): Promise<string> {
    const installation = await this.db.bitrixInstallation.findUnique({
      where: { memberId },
    });

    if (!installation) {
      throw new NotFoundException(
        `Установка Bitrix24 для портала ${memberId} не найдена`,
      );
    }

    try {
      const { data } = await axios.get(
        'https://oauth.bitrix.info/oauth/token/',
        {
          params: {
            grant_type: 'refresh_token',
            client_id: process.env.BITRIX24_CLIENT_ID,
            client_secret: process.env.BITRIX24_CLIENT_SECRET,
            refresh_token: installation.refreshToken,
          },
        },
      );

      const expiresAt = new Date(Date.now() + Number(data.expires_in) * 1000);

      await this.db.bitrixInstallation.update({
        where: { memberId },
        data: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          accessExpiresAt: expiresAt,
        },
      });

      return data.access_token as string;
    } catch (err) {
      throw new InternalServerErrorException(
        `Ошибка обновления токенов Bitrix24: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async getInstallation(memberId: string) {
    const installation = await this.db.bitrixInstallation.findUnique({
      where: { memberId },
    });

    if (!installation) {
      throw new NotFoundException(
        `Установка Bitrix24 для портала ${memberId} не найдена`,
      );
    }

    return installation;
  }
}

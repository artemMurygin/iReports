import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { BitrixService } from './bitrix.service';
import { BitrixAuthService } from './bitrix-auth.service';
import { BitrixInstallDto } from './dto/bitrix-install.dto';

@Controller('bitrix')
export class BitrixController {
  constructor(
    private readonly bitrixService: BitrixService,
    private readonly bitrixAuthService: BitrixAuthService,
  ) {}

  /**
   * Обработчик установки приложения из Bitrix24.
   * URL прописывается в настройках приложения как:
   *   - "Application installer URL" (mass-market)
   *   - "Initial installation path" (локальное приложение)
   *
   * Bitrix24 вызывает этот endpoint при первом открытии приложения администратором,
   * передавая OAuth-токены через POST (application/x-www-form-urlencoded).
   * В ответ возвращается HTML-страница, которая вызывает BX24.installFinish(),
   * после чего приложение считается установленным и становится доступным всем сотрудникам.
   */
  @Post('install')
  async install(
    @Body() body: BitrixInstallDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.bitrixAuthService.saveInstallation(body);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <script src="//api.bitrix24.com/api/v1/"></script>
  </head>
  <body>
    <script>
      BX24.init(function () {
        BX24.installFinish();
      });
    </script>
  </body>
</html>`);
  }
}

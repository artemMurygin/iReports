    # План реализации установки Bitrix24-приложения на бэкенде

## Контекст и проблема

Клиент встраивается как iframe-приложение в Bitrix24.  
Сейчас бэкенд использует **статический webhook-URL** (`BITRIX24_WEBHOOK_URL`) — это подходит только для серверных интеграций, где токен выпускается вручную под конкретного пользователя/портал.

При iframe-встраивании сотрудник открывает приложение прямо из интерфейса Bitrix24, и система ожидает полноценного **OAuth-потока с установкой приложения**. Пока `installFinish` не вызван — приложение считается **не установленным**, виджеты/события не работают, а обычные пользователи видят сообщение:  
> _"Приложение ещё не полностью установлено. Обратитесь к администратору Bitrix24."_

---

## Как работает установка приложения с интерфейсом

### Сценарий (Simplified OAuth внутри iframe)

1. Администратор устанавливает приложение в Bitrix24 Marketplace / Developer area.
2. Bitrix24 открывает URL установщика (Installation Wizard URL) в iframe и передаёт **POST-запрос** с токенами:

```
POST https://your-backend.com/bitrix/install
Content-Type: application/x-www-form-urlencoded

DOMAIN=account.bitrix24.com
PROTOCOL=1
LANG=ru
APP_SID=dd8cec11e347088fe87c44870a9f1dba
AUTH_ID=ahodg4h37n89vo17gbkgq0x1l825nnb5     ← access_token (живёт 1 час)
AUTH_EXPIRES=3600
REFRESH_ID=2lg086mxijlpvwh0h7r4nl19udm4try5   ← refresh_token (живёт 180 дней!)
member_id=a223c6b3710f85df22e9377d6c4f7553     ← уникальный ID портала
status=P
```

3. Бэкенд сохраняет токены, выполняет начальную настройку (регистрация виджетов, событий и т.д.).
4. **Фронтенд** (страница установщика, загруженная в iframe) вызывает `BX24.installFinish()`.
5. Только после этого Bitrix24 считает приложение **установленным**, и обычные сотрудники могут его открывать.

### Последующие открытия приложения сотрудниками

При каждом открытии iframe Bitrix24 также делает POST с актуальными `AUTH_ID` / `REFRESH_ID` на основной URL приложения. Бэкенд обновляет токены.

---

## Шаги реализации

---

### Шаг 1 — Prisma: модель `BitrixInstallation`

Создать новую модель для хранения OAuth-токенов по каждому порталу.

**Файл:** `backend/prisma/schema/bitrix.prisma` (или отдельный файл)

```prisma
model BitrixInstallation {
  id               Int      @id @default(autoincrement())
  memberId         String   @unique @map("member_id")   // уникальный ID портала
  domain           String                               // account.bitrix24.com
  accessToken      String   @map("access_token")
  refreshToken     String   @map("refresh_token")
  clientEndpoint   String   @map("client_endpoint")     // https://account.bitrix24.com/rest/
  serverEndpoint   String   @map("server_endpoint")     // https://oauth.bitrix.info/rest/
  accessExpiresAt  DateTime @map("access_expires_at")   // когда истекает access_token
  installedAt      DateTime @default(now()) @map("installed_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  @@map("bitrix_installations")
}
```

Создать и применить миграцию:
```bash
npx prisma migrate dev --name add_bitrix_installation
```

---

### Шаг 2 — Endpoint: `POST /bitrix/install` (Installation Wizard Handler)

Этот URL прописывается в настройках приложения Bitrix24 как **"Application installer URL"** (для mass-market) или **"Initial installation path"** (для локального приложения).

**Файл:** `backend/src/integrations/bitrix/bitrix.controller.ts`

```typescript
@Post('install')
async install(@Body() body: BitrixInstallDto, @Res() res: Response) {
  await this.bitrixAuthService.saveInstallation(body);
  // Возвращаем HTML-страницу, которая вызывает BX24.installFinish()
  res.send(`
    <html>
      <head>
        <script src="//api.bitrix24.com/api/v1/"></script>
      </head>
      <body>
        <script>
          BX24.init(function() {
            BX24.installFinish();
          });
        </script>
      </body>
    </html>
  `);
}
```

**DTO** `BitrixInstallDto`:
```typescript
export class BitrixInstallDto {
  DOMAIN: string;
  PROTOCOL: string;
  AUTH_ID: string;       // access_token
  AUTH_EXPIRES: string;  // секунды
  REFRESH_ID: string;    // refresh_token
  member_id: string;
  status: string;
  APP_SID?: string;
  LANG?: string;
}
```

> ⚠️ **Важно:** endpoint должен быть доступен без авторизации (публичный), так как Bitrix24 обращается к нему напрямую.

---

### Шаг 3 — `BitrixAuthService`: сохранение и обновление токенов

**Файл:** `backend/src/integrations/bitrix/bitrix-auth.service.ts`

#### 3.1 `saveInstallation(body)` — сохранение при установке

```typescript
async saveInstallation(body: BitrixInstallDto) {
  const expiresAt = new Date(Date.now() + Number(body.AUTH_EXPIRES) * 1000);

  await this.db.bitrixInstallation.upsert({
    where: { memberId: body.member_id },
    create: {
      memberId: body.member_id,
      domain: body.DOMAIN,
      accessToken: body.AUTH_ID,
      refreshToken: body.REFRESH_ID,
      clientEndpoint: `https://${body.DOMAIN}/rest/`,
      serverEndpoint: 'https://oauth.bitrix.info/rest/',
      accessExpiresAt: expiresAt,
    },
    update: {
      domain: body.DOMAIN,
      accessToken: body.AUTH_ID,
      refreshToken: body.REFRESH_ID,
      accessExpiresAt: expiresAt,
    },
  });
}
```

#### 3.2 `getValidAccessToken(memberId)` — получение актуального токена

```typescript
async getValidAccessToken(memberId: string): Promise<string> {
  const installation = await this.db.bitrixInstallation.findUniqueOrThrow({
    where: { memberId },
  });

  // Если access_token ещё действителен — возвращаем его
  const isExpired = installation.accessExpiresAt < new Date();
  if (!isExpired) {
    return installation.accessToken;
  }

  // Иначе — обновляем через refresh_token
  return this.refreshTokens(memberId);
}
```

#### 3.3 `refreshTokens(memberId)` — обновление пары токенов

```typescript
async refreshTokens(memberId: string): Promise<string> {
  const installation = await this.db.bitrixInstallation.findUniqueOrThrow({
    where: { memberId },
  });

  const response = await axios.get('https://oauth.bitrix.info/oauth/token/', {
    params: {
      grant_type: 'refresh_token',
      client_id: process.env.BITRIX24_CLIENT_ID,
      client_secret: process.env.BITRIX24_CLIENT_SECRET,
      refresh_token: installation.refreshToken,
    },
  });

  const { access_token, refresh_token, expires_in } = response.data;
  const expiresAt = new Date(Date.now() + Number(expires_in) * 1000);

  await this.db.bitrixInstallation.update({
    where: { memberId },
    data: {
      accessToken: access_token,
      refreshToken: refresh_token, // Bitrix24 выдаёт НОВЫЙ refresh_token!
      accessExpiresAt: expiresAt,
    },
  });

  return access_token;
}
```

> ⚠️ **Важно:** при каждом вызове `/oauth/token` Bitrix24 возвращает **новую пару** токенов. Оба нужно сохранять.  
> Не вызывать refresh перед каждым запросом — только при ошибке `expired_token`.

---

### Шаг 4 — Переменные окружения

Добавить в `.env` и `.env.example`:

```env
# Bitrix24 OAuth App Credentials
BITRIX24_CLIENT_ID=app.xxxxxxxxxx.xxxxxxxxxx
BITRIX24_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> Эти ключи берутся из **партнёрского кабинета Bitrix24** (для mass-market) или из настроек локального приложения на портале.

---

### Шаг 5 — Адаптация существующего `BitrixHttpService`

Текущий `BitrixHttpService` использует статический webhook (`BITRIX24_WEBHOOK_URL`). Нужно:

1. Оставить webhook для серверных операций (sync, cron), которые не требуют конкретного пользователя.
2. Добавить метод для запросов **от имени конкретного портала** (для iframe-сценария):

```typescript
async callMethod(memberId: string, method: string, params = {}) {
  const accessToken = await this.bitrixAuthService.getValidAccessToken(memberId);
  const installation = await this.db.bitrixInstallation.findUnique({ where: { memberId } });

  try {
    const response = await axios.post(
      `${installation.clientEndpoint}${method}`,
      { ...params, auth: accessToken },
    );
    return response.data;
  } catch (err) {
    if (err.response?.data?.error === 'expired_token') {
      // Токен протух — обновляем и повторяем
      const newToken = await this.bitrixAuthService.refreshTokens(memberId);
      const response = await axios.post(
        `${installation.clientEndpoint}${method}`,
        { ...params, auth: newToken },
      );
      return response.data;
    }
    throw err;
  }
}
```

---

### Шаг 6 — Guard для iframe-запросов (опционально, но рекомендовано)

При каждом открытии iframe Bitrix24 делает POST с `member_id` и актуальными токенами.  
Создать `BitrixIframeGuard`, который:

1. Извлекает `member_id` из тела POST-запроса.
2. Проверяет, что портал установлен в БД.
3. Обновляет токены (если переданы новые).
4. Прокидывает `member_id` в `Request` для использования в контроллерах.

---

### Шаг 7 — Регистрация модуля

**Файл:** `backend/src/app.module.ts`

Добавить `BitrixAuthModule` в список импортов, если он будет выделен в отдельный модуль.

---

## Итоговая структура файлов

```
backend/src/integrations/bitrix/
├── bitrix.module.ts          # добавить BitrixAuthService
├── bitrix.controller.ts      # добавить POST /bitrix/install
├── bitrix.instance.ts        # существующий HTTP-клиент (webhook)
├── bitrix.service.ts         # существующая логика
├── bitrix-auth.service.ts    # НОВЫЙ: OAuth, хранение/обновление токенов
├── dto/
│   └── bitrix-install.dto.ts # НОВЫЙ: DTO для /bitrix/install
└── types.ts
```

---

## Чеклист проверки установки

| # | Проверка | Как проверить |
|---|----------|---------------|
| 1 | Endpoint `POST /bitrix/install` доступен публично | `curl -X POST https://your-domain/bitrix/install -d "AUTH_ID=xxx&REFRESH_ID=xxx&member_id=xxx&DOMAIN=xxx&AUTH_EXPIRES=3600"` |
| 2 | Токены сохраняются в таблице `bitrix_installations` | Проверить в БД после установки |
| 3 | Страница установщика вызывает `BX24.installFinish()` | Открыть приложение как администратор — должна открыться нормально |
| 4 | `app.info` возвращает `INSTALLED: true` | Вызвать через BX24.js на фронтенде |
| 5 | Обычные сотрудники видят приложение | Открыть под не-администратором |
| 6 | Обновление токенов работает | Подождать час или вручную обнулить `accessExpiresAt` в БД |

---

## Ссылки на документацию

- [Simplified OAuth (iframe-сценарий)](https://apidocs.bitrix24.com/settings/oauth/simple-way.html)
- [Completing Application Installation (installFinish)](https://apidocs.bitrix24.com/settings/app-installation/installation-finish.html)
- [Automatic Token Renewal](https://apidocs.bitrix24.com/settings/oauth/auto-renewal.html)
- [Complete OAuth 2.0 Protocol](https://apidocs.bitrix24.com/settings/oauth/index.html)
- [Overview of Mass-Market App Installation](https://apidocs.bitrix24.com/settings/app-installation/mass-market-apps/index.html)
- [app.info method](https://apidocs.bitrix24.com/api-reference/common/system/app-info.html)
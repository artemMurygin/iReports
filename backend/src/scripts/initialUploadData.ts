import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { CommandBus } from '@nestjs/cqrs';
import { AppModule } from '../app.module';
import { runInSystemRequestContext } from '../shared/application/context/run-in-system-context';
import { UploadInitialBitrixDataCommand } from '../sync/bitrix/application/command/upload-initial-bitrix-data.command';
import { UploadInitialMoySkladDataCommand } from '../domains/shop/sync/moySklad/application/command/upload-initial-moysklad-data.command';
import { UploadInitialRoappDataCommand } from '../domains/service/sync/roapp/application/command/upload-initial-roapp-data.command';

async function bootstrap() {
    const dateArg = process.argv[2];
    const erp = process.argv[3];

    if (!dateArg) {
        console.error('Usage: npm run initial -- <date> (e.g. 2025-01-01)');
        process.exit(1);
    }

    if (!erp) {
        console.error(
            'Необходимо передавать erp систему вторым аргументом, что бы начать выгрузку данных',
        );
        process.exit(1);
    }

    const fromDate = new Date(dateArg);
    if (isNaN(fromDate.getTime())) {
        console.error(`Invalid date: "${dateArg}". Use format YYYY-MM-DD`);
        process.exit(1);
    }

    const app = await NestFactory.createApplicationContext(AppModule);
    const commandBus = app.get(CommandBus);

    try {
        await runInSystemRequestContext(async () => {
            if (erp.includes('B')) {
                await commandBus.execute(
                    new UploadInitialBitrixDataCommand({ fromDate }),
                );
            }

            if (erp.includes('M')) {
                await commandBus.execute(
                    new UploadInitialMoySkladDataCommand({ fromDate }),
                );
            }

            if (erp.includes('R')) {
                await commandBus.execute(
                    new UploadInitialRoappDataCommand({ fromDate }),
                );
            }
        });

        await app.close();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

void bootstrap();

import { Command, CommandProps } from '@/shared/domain/command.base';

// Запуск джобы импорта закупочных цен магазина из прайса поставщика (Фаза 9, см.
// docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md) — файл передаётся как
// base64 внутри JSON, формат не меняется (см. src/TODO/priceMonitoring/dto/updateShopProductsCosts.dto.ts).
export class StartPriceImportCommand extends Command {
    readonly fileBase64: string;

    constructor(props: CommandProps<StartPriceImportCommand>) {
        super(props);
        this.fileBase64 = props.fileBase64;
    }
}

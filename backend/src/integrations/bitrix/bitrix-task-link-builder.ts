// Прямая ссылка на задачу в веб-интерфейсе Bitrix24 — по аналогии с
// erp-order-link-builder.ts (buildErpOrderLink), но, в отличие от него,
// ОБЩАЯ для service/shop (design.md Decision 7): URL задачи Bitrix24 не
// зависит от направления, доменных данных в построении ссылки нет — та же
// логика, что уже применена к BitrixTasksGatewayPort. Живёт вне
// domains/{service,shop} по этой же причине (архитектура, раздел
// "buildBitrixTaskLink").
//
// Портал берётся из того же BITRIX24_WEBHOOK_URL, которым уже пользуется
// BitrixHttpService (bitrix.instance.ts), а не хардкодится строкой — иначе
// ссылка вела бы не на тот портал при смене окружения (dev/staging/prod).
export function buildBitrixTaskLink(bitrixTaskId: string): string {
    const webhookUrl = process.env.BITRIX24_WEBHOOK_URL;
    if (!webhookUrl) {
        throw new Error(
            'BITRIX24_WEBHOOK_URL не задан — невозможно построить ссылку на задачу Bitrix24',
        );
    }

    const { origin } = new URL(webhookUrl);
    return `${origin}/company/personal/user/0/tasks/task/view/${bitrixTaskId}/`;
}

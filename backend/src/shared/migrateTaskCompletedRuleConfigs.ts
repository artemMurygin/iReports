import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DatabaseService } from '../infrustructure/database/database.service';

// Разовый перенос конфига правил TaskCompleted, созданных ДО change
// salary-rule-bitrix-task, на новую обязательную форму (design.md,
// Decision 1/2/9): старый формат — только `{ award: { type: 'Fixed' |
// 'FloatPercent', ... } }`, без description/period/isRecurring/dueDate/
// rewardAmount, которые SalaryRuleMapper.toDomain теперь требует при
// каждом чтении правила из БД (Zod parse), — без миграции любой отчёт,
// затрагивающий такое правило, падает с ZodError вместо отдачи данных.
//
// `rewardAmount` переносится из award.price (Fixed) — единственный
// реквизит старого формата, у которого есть прямой аналог в новом.
// FloatPercent прямого аналога не имеет (эта форма вознаграждения убрана
// вместе с этим change, design.md Decision 2) — такие правила логируются
// отдельно и НЕ трогаются, чтобы не потерять/исказить сумму; требуют
// ручного решения руководителя.
// bitrixTaskIds сознательно не проставляется (правило ещё не привязано ни
// к одной реальной задаче Bitrix24) — calculate() для такого правила
// корректно даёт 0 и в факте, и в прогнозе с пометкой isUnavailable (не
// «тихо» продолжает платить по старым нереальным начислениям, но и не
// падает). description/period/dueDate — плейсхолдеры, отмеченные как
// требующие ручной проверки; руководитель должен пересохранить правило
// через новую форму, чтобы фактически привязать его к задаче Bitrix24.
//
// Безопасен для повторного запуска — правила, уже имеющие поле
// `rewardAmount` в props, пропускаются.
async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const db = app.get(DatabaseService);

    try {
        const rules = await db.salaryRule.findMany({
            where: { type: 'TaskCompleted' },
        });

        const now = new Date();
        const period = `${now.getFullYear()}-${String(
            now.getMonth() + 1,
        ).padStart(2, '0')}`;
        const dueDate = `${period}-${String(
            new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
        ).padStart(2, '0')}`;

        let migrated = 0;
        let skippedAlready = 0;
        let skippedFloatPercent = 0;

        for (const rule of rules) {
            const props = rule.props as Record<string, unknown>;

            if (typeof props.rewardAmount === 'number') {
                skippedAlready++;
                continue;
            }

            const award = props.award as
                | { type?: string; price?: number }
                | undefined;

            if (!award || award.type !== 'Fixed') {
                console.warn(
                    `Правило ${rule.id} ("${rule.name}") имеет старый формат награды ` +
                        `${award?.type ?? 'неизвестный'} без прямого аналога — ` +
                        'пропущено, требует ручного решения руководителя.',
                );
                skippedFloatPercent++;
                continue;
            }

            await db.salaryRule.update({
                where: { id: rule.id },
                data: {
                    props: {
                        description:
                            '[Перенесено из старого формата при миграции на Bitrix24-интеграцию] ' +
                            'Требует привязки к реальной задаче Bitrix24 — пересохраните правило через форму.',
                        period,
                        isRecurring: false,
                        dueDate,
                        rewardAmount: award.price ?? 0,
                    },
                },
            });
            migrated++;
        }

        console.log(
            `Перенесено правил: ${migrated}. Уже в новом формате: ${skippedAlready}. ` +
                `Пропущено (FloatPercent, требует ручного решения): ${skippedFloatPercent}.`,
        );

        await app.close();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

void bootstrap();

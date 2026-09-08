-- AlterTable
-- Добавляем target_role как NOT NULL: временный DEFAULT нужен только чтобы
-- ALTER TABLE не упал на уже существующих строках, дальше он снимается —
-- новые правила всегда обязаны задавать targetRole явно (см. SalaryRuleMapper).
ALTER TABLE "salary_rules" ADD COLUMN "target_role" TEXT NOT NULL DEFAULT 'ENGINEER';
ALTER TABLE "salary_rules" ALTER COLUMN "target_role" DROP DEFAULT;

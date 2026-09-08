/*
  Warnings:

  - You are about to drop the `task_completions` table. If the table is not empty, all the data it contains will be lost.

*/
-- Удаление зарплатного правила TaskCompleted и временного воркфлоу
-- TaskCompletion (полное удаление фичи по запросу пользователя) —
-- сначала чистим осиротевшие строки salary_rules с типом правила,
-- которого больше нет в коде (иначе чтение мотивационной схемы с такой
-- строкой падало бы на unregistered rule type), затем дропаем саму
-- таблицу воркфлоу подтверждения.
DELETE FROM "salary_rules" WHERE "type" = 'TaskCompleted';

-- DropTable
DROP TABLE "task_completions";

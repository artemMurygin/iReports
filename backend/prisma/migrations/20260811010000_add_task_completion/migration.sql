-- CreateTable
CREATE TABLE "task_completions" (
    "id" TEXT NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "created_by" INTEGER NOT NULL,
    "confirmed_by" INTEGER,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_completions_period_employee_id_idx" ON "task_completions"("period", "employee_id");

-- CreateIndex
CREATE INDEX "task_completions_period_status_idx" ON "task_completions"("period", "status");

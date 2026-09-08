-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "direction" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "deadline" TIMESTAMP(3) NOT NULL,
    "assignee_employee_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "closed_successfully_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_direction_idx" ON "tasks"("direction");

-- CreateIndex
CREATE INDEX "tasks_assignee_employee_id_idx" ON "tasks"("assignee_employee_id");

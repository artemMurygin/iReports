-- CreateTable
CREATE TABLE "work_schedule_entries" (
    "id" TEXT NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "hours" DOUBLE PRECISION,
    "role" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_schedule_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_schedule_entries_employee_id_date_key" ON "work_schedule_entries"("employee_id", "date");

-- CreateIndex
CREATE INDEX "work_schedule_entries_date_idx" ON "work_schedule_entries"("date");

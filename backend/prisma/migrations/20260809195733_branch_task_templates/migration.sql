-- Round 3, Task 1: branch_task_templates
-- Additive only. Creates one new table. Does not touch any existing table, column, or data.
-- NOT applied by this change — a human reviews and applies this to the live database.

-- CreateTable
CREATE TABLE "branch_task_templates" (
    "template_id" SERIAL NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "day_of_week" SMALLINT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "skill_id" INTEGER,
    "start_time" TIME(6),
    "end_time" TIME(6),
    "required_workers" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_task_templates_pkey" PRIMARY KEY ("template_id")
);

-- CreateIndex
CREATE INDEX "idx_branch_task_templates_branch_day" ON "branch_task_templates"("branch_id", "day_of_week");

-- AddForeignKey
ALTER TABLE "branch_task_templates" ADD CONSTRAINT "branch_task_templates_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "branch_task_templates" ADD CONSTRAINT "branch_task_templates_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("skill_id") ON DELETE SET NULL ON UPDATE NO ACTION;

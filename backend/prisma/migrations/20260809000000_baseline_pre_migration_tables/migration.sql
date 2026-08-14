-- Baseline: tables that predate migration tracking in this repo.
--
-- schema.prisma declares 34 models but prisma/migrations/ (before this file) only ever created 5
-- of them — the "Task N" migrations that follow this one, each adding one new table for a single
-- feature. The other 29 tables, including `users`, `businesses`, `branches`, `staff`, `shifts`,
-- and `task_assignments`, were never captured by a migration at all: they were built by hand (or
-- `prisma db push`) directly against the shared dev database before migration history started,
-- and every "Task N" migration since has been an incremental patch layered on top of that
-- already-existing, untracked schema. Proof: the very first tracked migration
-- (20260809195733_branch_task_templates) adds foreign keys to "branches" and "skills" — tables no
-- migration creates — so `prisma migrate deploy` against a genuinely empty database has never
-- actually worked.
--
-- The gap was invisible until two of the 29 — business_settings and branch_allocation_preferences
-- — were needed on an environment that never had them hand-created: business registration and
-- allocation-weight saves fail there with "Could not find the table ... in the schema cache"
-- (PostgREST, via supabaseAdmin.from(...)). Fixing only those two would still leave every other
-- environment (and any future fresh one, e.g. CI) exposed to the same failure the moment it hits
-- an untracked table, so this migration creates all 29.
--
-- Every statement is guarded (CREATE TABLE/INDEX IF NOT EXISTS, ADD CONSTRAINT wrapped in a
-- DO block that swallows duplicate_object) so it is a no-op wherever a table already exists by
-- hand. It deliberately excludes columns that a later "Task N" migration adds via ALTER TABLE
-- (shifts.source, branch_settings.treat_public_holidays_as_working/industry,
-- timesheets.start_time/end_time/break_minutes, shift_tasks.period_id) so this migration plus the
-- unchanged existing history reproduces schema.prisma exactly. Verified by applying this file,
-- then every existing migration in order, to an empty database and diffing the result against
-- schema.prisma with `prisma migrate diff --from-url <empty-db> --to-schema-datamodel
-- schema.prisma --script` — the only difference found was an unrelated, pre-existing drift in
-- casual_period_availability, fixed separately in
-- 20260812000000_casual_period_availability_day_of_week.
--
-- Deployment on an environment that already has this schema by hand (every environment running
-- today): run `npx prisma migrate resolve --applied 20260809000000_baseline_pre_migration_tables`
-- BEFORE `migrate deploy`, so Prisma's migration history is corrected without this file executing
-- against live tables. `migrate deploy` then only ever runs this for real against a genuinely
-- empty database (a fresh CI/test DB, or a new environment), where it builds the same schema from
-- scratch.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" SERIAL NOT NULL,
    "actor_id" INTEGER,
    "action" VARCHAR(50) NOT NULL,
    "entity" VARCHAR(50) NOT NULL,
    "entity_id" INTEGER,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "availability" (
    "request_id" SERIAL NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "leave_type" VARCHAR(20) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "reason" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMP(6),

    CONSTRAINT "availability_pkey" PRIMARY KEY ("request_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "branch_managers" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outlet_managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "branch_settings" (
    "setting_id" SERIAL NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "operating_days" TEXT NOT NULL DEFAULT '1111100',
    "holidays" JSONB NOT NULL DEFAULT '[]',
    "work_hours_day" INTEGER NOT NULL DEFAULT 8,
    "max_work_hours_day" INTEGER NOT NULL DEFAULT 12,
    "max_consecutive_days" INTEGER NOT NULL DEFAULT 6,
    "allow_overtime" BOOLEAN NOT NULL DEFAULT false,
    "min_workers_per_assignment" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "off_days_per_week" INTEGER DEFAULT 1,
    "business_id" INTEGER,

    CONSTRAINT "outlet_settings_pkey" PRIMARY KEY ("setting_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "branch_skills" (
    "id" SERIAL NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "skill_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "branch_role_templates" (
    "template_id" SERIAL NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "role_name" VARCHAR NOT NULL,
    "skill_id" INTEGER,
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_role_templates_pkey" PRIMARY KEY ("template_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "branch_allocation_preferences" (
    "id" SERIAL NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "weight_availability" INTEGER NOT NULL DEFAULT 40,
    "weight_skills" INTEGER NOT NULL DEFAULT 30,
    "weight_attendance" INTEGER NOT NULL DEFAULT 15,
    "weight_performance" INTEGER NOT NULL DEFAULT 10,
    "weight_workload" INTEGER NOT NULL DEFAULT 5,
    "updated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_allocation_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "branches" (
    "branch_id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "address" TEXT,
    "business_id" INTEGER,
    "open_time" TIME(6) DEFAULT '08:00:00'::time without time zone,
    "close_time" TIME(6) DEFAULT '22:00:00'::time without time zone,
    "location_type" VARCHAR(50) NOT NULL DEFAULT 'outlet',
    "working_days" INTEGER NOT NULL DEFAULT 7,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "outlets_pkey" PRIMARY KEY ("branch_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "businesses" (
    "business_id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "owner_id" INTEGER,
    "industry" VARCHAR(100),
    "contact_email" VARCHAR(255),
    "contact_phone" VARCHAR(30),
    "address" TEXT,
    "website" VARCHAR(255),
    "plan" VARCHAR(20) NOT NULL DEFAULT 'free',
    "scheduling_mode" VARCHAR(20) NOT NULL DEFAULT 'shift',
    "location_label" VARCHAR(50) NOT NULL DEFAULT 'Outlet',
    "staff_label" VARCHAR(50) NOT NULL DEFAULT 'Staff',
    "join_code" VARCHAR(12),
    "default_casual_hours" DECIMAL DEFAULT 20,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("business_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "casual_availability" (
    "availability_id" SERIAL NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "week_start_date" DATE NOT NULL,
    "day_of_week" SMALLINT NOT NULL,
    "available_from" TIME(6) NOT NULL,
    "available_to" TIME(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "casual_availability_pkey" PRIMARY KEY ("availability_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "casual_branch_preferences" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "casual_branch_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "casual_workers" (
    "id" BIGSERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "business_id" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "bio" TEXT,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMPTZ(6),

    CONSTRAINT "casual_workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "invitations" (
    "id" SERIAL NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" VARCHAR(30) NOT NULL,
    "branch_id" INTEGER,
    "business_id" INTEGER,
    "invited_by" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL DEFAULT (now() + '7 days'::interval),
    "accepted_at" TIMESTAMPTZ(6),
    "invitation_code" VARCHAR(10),
    "accepted_by" INTEGER,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notifications" (
    "notification_id" SERIAL NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT,
    "related_entity" VARCHAR(50),
    "related_id" INTEGER,
    "is_read" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notification_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "off_day_requests" (
    "id" SERIAL NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "requested_date" DATE NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(6),
    "reviewed_by" INTEGER,

    CONSTRAINT "off_day_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "reports" (
    "report_id" SERIAL NOT NULL,
    "branch_id" INTEGER,
    "generated_by" INTEGER NOT NULL,
    "report_type" VARCHAR(50) NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "parameters" JSONB,
    "result_data" JSONB,
    "format" VARCHAR(10) NOT NULL DEFAULT 'csv',
    "title" VARCHAR(200),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("report_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "shift_tasks" (
    "task_id" SERIAL NOT NULL,
    "shift_id" INTEGER NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "skill_id" INTEGER,
    "start_time" TIME(6),
    "end_time" TIME(6),
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "difficulty" VARCHAR(20),

    CONSTRAINT "shift_tasks_pkey" PRIMARY KEY ("task_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "shifts" (
    "shift_id" SERIAL NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "title" VARCHAR(100),
    "shift_date" DATE NOT NULL,
    "start_time" TIME(6) NOT NULL,
    "end_time" TIME(6) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "created_by" INTEGER,
    "shift_type" VARCHAR(30) NOT NULL DEFAULT 'regular',
    "deadline" DATE,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("shift_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "skills" (
    "skill_id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_by" INTEGER,
    "branch_id" INTEGER,
    "business_id" INTEGER,
    "industry_type" VARCHAR(30),
    "is_catalog" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("skill_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "staff" (
    "staff_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "branch_id" INTEGER,
    "staff_type" VARCHAR(20) NOT NULL,
    "default_work_days" VARCHAR(7),
    "hired_at" DATE,
    "is_active" BOOLEAN DEFAULT true,
    "exp_level" VARCHAR(20),
    "annual_leave_days_per_year" INTEGER NOT NULL DEFAULT 14,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("staff_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "swap_requests" (
    "swap_id" SERIAL NOT NULL,
    "requester_id" INTEGER NOT NULL,
    "requester_assign" INTEGER NOT NULL,
    "target_staff_id" INTEGER,
    "target_assign_id" INTEGER,
    "request_type" VARCHAR(20) NOT NULL,
    "reason" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "responded_at" TIMESTAMP(6),
    "manager_id" INTEGER,
    "manager_decided_at" TIMESTAMP(6),

    CONSTRAINT "swap_requests_pkey" PRIMARY KEY ("swap_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "task_assignments" (
    "assignment_id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "shift_id" INTEGER NOT NULL,
    "staff_id" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'assigned',
    "acknowledged" BOOLEAN DEFAULT false,
    "assigned_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "is_cover" BOOLEAN DEFAULT false,

    CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("assignment_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "timesheets" (
    "timesheet_id" SERIAL NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "log_date" DATE NOT NULL,
    "hours_worked" DECIMAL(4,1) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "shift_id" INTEGER,
    "evidence_path" TEXT,
    "evidence_name" TEXT,

    CONSTRAINT "timesheets_pkey" PRIMARY KEY ("timesheet_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_skill_tags" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "skill_id" INTEGER NOT NULL,
    "experience_level" TEXT,
    "years_of_experience" DECIMAL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_skill_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "users" (
    "user_id" SERIAL NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "role" VARCHAR(30) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "full_name" VARCHAR(100),
    "avatar_url" VARCHAR(255) DEFAULT '/avatars/default.png',

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "subscription" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6),

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "allocation_preferences" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "weight_availability" INTEGER NOT NULL DEFAULT 40,
    "weight_skills" INTEGER NOT NULL DEFAULT 30,
    "weight_attendance" INTEGER NOT NULL DEFAULT 15,
    "weight_performance" INTEGER NOT NULL DEFAULT 10,
    "weight_workload" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allocation_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "business_roles" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "role_name" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "is_suggested" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "business_settings" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "operating_days" VARCHAR(7) NOT NULL DEFAULT '1111100',
    "open_time" VARCHAR(5) NOT NULL DEFAULT '09:00',
    "close_time" VARCHAR(5) NOT NULL DEFAULT '18:00',
    "holidays" JSONB NOT NULL DEFAULT '[]',
    "work_hours_day" INTEGER NOT NULL DEFAULT 8,
    "max_work_hours_day" INTEGER NOT NULL DEFAULT 12,
    "max_consecutive_days" INTEGER NOT NULL DEFAULT 6,
    "allow_overtime" BOOLEAN NOT NULL DEFAULT false,
    "min_workers_per_assignment" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_outlet_managers_user" ON "branch_managers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "outlet_managers_user_id_outlet_id_key" ON "branch_managers"("user_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "outlet_settings_outlet_id_key" ON "branch_settings"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "branch_skills_branch_id_skill_id_key" ON "branch_skills"("branch_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "branch_allocation_preferences_branch_id_key" ON "branch_allocation_preferences"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "businesses_join_code_key" ON "businesses"("join_code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_casual_availability_staff_week" ON "casual_availability"("staff_id", "week_start_date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "casual_availability_staff_id_week_start_date_day_of_week_key" ON "casual_availability"("staff_id", "week_start_date", "day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "casual_branch_preferences_user_id_outlet_id_key" ON "casual_branch_preferences"("user_id", "branch_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "casual_workers_business_id_idx" ON "casual_workers"("business_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "casual_workers_status_idx" ON "casual_workers"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "casual_workers_user_id_idx" ON "casual_workers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "casual_workers_user_id_business_id_key" ON "casual_workers"("user_id", "business_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "invitations_invitation_code_key" ON "invitations"("invitation_code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_shift_tasks_shift" ON "shift_tasks"("shift_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_shifts_outlet_date" ON "shifts"("branch_id", "shift_date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "skills_name_outlet_id_key" ON "skills"("name", "branch_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_swap_requester" ON "swap_requests"("requester_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_task_assignments_shift" ON "task_assignments"("shift_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_task_assignments_staff" ON "task_assignments"("staff_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_skill_tags_user_id_skill_id_key" ON "user_skill_tags"("user_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "allocation_preferences_business_id_key" ON "allocation_preferences"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "business_roles_business_id_role_name_key" ON "business_roles"("business_id", "role_name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "business_settings_business_id_key" ON "business_settings"("business_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "availability" ADD CONSTRAINT "availability_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "availability" ADD CONSTRAINT "availability_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("staff_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "branch_managers" ADD CONSTRAINT "outlet_managers_outlet_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "branch_managers" ADD CONSTRAINT "outlet_managers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "branch_settings" ADD CONSTRAINT "branch_settings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("business_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "branch_settings" ADD CONSTRAINT "outlet_settings_outlet_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "branch_skills" ADD CONSTRAINT "branch_skills_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "branch_skills" ADD CONSTRAINT "branch_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("skill_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "branch_role_templates" ADD CONSTRAINT "branch_role_templates_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "branch_role_templates" ADD CONSTRAINT "branch_role_templates_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("skill_id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "branch_allocation_preferences" ADD CONSTRAINT "branch_allocation_preferences_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "branches" ADD CONSTRAINT "outlets_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("business_id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "casual_availability" ADD CONSTRAINT "casual_availability_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("staff_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "casual_branch_preferences" ADD CONSTRAINT "casual_branch_preferences_outlet_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "casual_branch_preferences" ADD CONSTRAINT "casual_branch_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "casual_workers" ADD CONSTRAINT "casual_workers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("business_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "casual_workers" ADD CONSTRAINT "casual_workers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "invitations" ADD CONSTRAINT "invitations_outlet_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "off_day_requests" ADD CONSTRAINT "off_day_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "staff"("staff_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "off_day_requests" ADD CONSTRAINT "off_day_requests_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("staff_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "reports" ADD CONSTRAINT "reports_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "reports" ADD CONSTRAINT "reports_outlet_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "shift_tasks" ADD CONSTRAINT "shift_tasks_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("shift_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "shift_tasks" ADD CONSTRAINT "shift_tasks_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("skill_id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "shifts" ADD CONSTRAINT "shifts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "shifts" ADD CONSTRAINT "shifts_outlet_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "skills" ADD CONSTRAINT "skills_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("business_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "skills" ADD CONSTRAINT "skills_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "staff" ADD CONSTRAINT "staff_outlet_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_requester_assign_fkey" FOREIGN KEY ("requester_assign") REFERENCES "task_assignments"("assignment_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_target_assign_id_fkey" FOREIGN KEY ("target_assign_id") REFERENCES "task_assignments"("assignment_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("shift_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("staff_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "shift_tasks"("task_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("staff_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "user_skill_tags" ADD CONSTRAINT "user_skill_tags_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("skill_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "user_skill_tags" ADD CONSTRAINT "user_skill_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "allocation_preferences" ADD CONSTRAINT "allocation_preferences_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("business_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "business_roles" ADD CONSTRAINT "business_roles_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("business_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("business_id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tables are read through supabaseAdmin.from(...), which goes via PostgREST rather than a plain
-- SQL connection — PostgREST caches the schema at startup, so any newly created table is
-- invisible to it until the cache is told to reload.
NOTIFY pgrst, 'reload schema';

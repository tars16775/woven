CREATE TABLE `actions` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`actor_kind` text NOT NULL,
	`actor_id` text NOT NULL,
	`capability` text NOT NULL,
	`target` text NOT NULL,
	`parameters` text NOT NULL,
	`params_hash` text NOT NULL,
	`risk_class` text NOT NULL,
	`namespace` text NOT NULL,
	`status` text NOT NULL,
	`preview` text NOT NULL,
	`decision_outcome` text NOT NULL,
	`decision_reason` text NOT NULL,
	`approval_by` text,
	`approval_factors` text,
	`approved_by` text,
	`approved_at` text,
	`planned` text,
	`observed` text,
	`error` text,
	`idempotency_key` text,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `actions_household_status_idx` ON `actions` (`household_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `actions_idempotency_idx` ON `actions` (`household_id`,`actor_id`,`idempotency_key`);
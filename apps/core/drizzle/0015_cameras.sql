CREATE TABLE `cameras` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`place` text,
	`transport` text NOT NULL,
	`address` text NOT NULL,
	`state` text DEFAULT 'live' NOT NULL,
	`detection` integer DEFAULT true NOT NULL,
	`retention_days` integer DEFAULT 14 NOT NULL,
	`last_event_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cameras_household_idx` ON `cameras` (`household_id`);--> statement-breakpoint
CREATE TABLE `camera_events` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`camera_id` text NOT NULL,
	`at` text NOT NULL,
	`kind` text NOT NULL,
	`clip_seconds` real,
	`clip_object_sha` text,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`camera_id`) REFERENCES `cameras`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `camera_events_household_idx` ON `camera_events` (`household_id`,`at`);--> statement-breakpoint
CREATE INDEX `camera_events_camera_idx` ON `camera_events` (`camera_id`);

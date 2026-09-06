CREATE TABLE `memories` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`person_id` text NOT NULL,
	`text` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`seen` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`expires_at` text,
	`deleted_at` text,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `memories_person_idx` ON `memories` (`person_id`);
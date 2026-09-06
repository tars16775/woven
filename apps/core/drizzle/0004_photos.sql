CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`household_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`namespace` text NOT NULL,
	`sha256` text NOT NULL,
	`taken_at` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`camera` text,
	`lat` real,
	`lon` real,
	`thumb_sha` text NOT NULL,
	`preview_sha` text NOT NULL,
	`created_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photos_file_idx` ON `photos` (`file_id`);--> statement-breakpoint
CREATE INDEX `photos_household_taken_idx` ON `photos` (`household_id`,`taken_at`);
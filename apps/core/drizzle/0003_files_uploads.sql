CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`household_id` text NOT NULL,
	`namespace` text NOT NULL,
	`path` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`mime` text,
	`sha256` text,
	`chunk_size` integer NOT NULL,
	`received` text DEFAULT '[]' NOT NULL,
	`source` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `files` ADD `source` text;--> statement-breakpoint
CREATE INDEX `files_household_ns_idx` ON `files` (`household_id`,`namespace`);
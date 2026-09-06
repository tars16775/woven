CREATE TABLE `shares` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`household_id` text NOT NULL,
	`created_by` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`max_downloads` integer,
	`downloads` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`last_used_at` text,
	`revoked_at` text,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shares_token_idx` ON `shares` (`token_hash`);--> statement-breakpoint
CREATE INDEX `shares_file_idx` ON `shares` (`file_id`);
CREATE TABLE `remote_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`person_id` text NOT NULL,
	`label` text NOT NULL,
	`key_sealed` text NOT NULL,
	`session_id` text NOT NULL,
	`created_at` text NOT NULL,
	`last_seen_at` text,
	`revoked_at` text,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `remote_devices_person_idx` ON `remote_devices` (`person_id`);
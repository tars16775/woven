CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`person_id` text NOT NULL,
	`host` text NOT NULL,
	`sealed` text NOT NULL,
	`label` text,
	`created_at` text NOT NULL,
	`last_sent_at` text,
	`failures` integer DEFAULT 0 NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `push_subscriptions_person_idx` ON `push_subscriptions` (`person_id`);
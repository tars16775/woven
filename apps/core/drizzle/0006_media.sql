CREATE TABLE `media` (
	`file_id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`kind` text NOT NULL,
	`duration_s` real,
	`width` integer,
	`height` integer,
	`video_codec` text,
	`audio_codec` text,
	`container` text,
	`playable` integer NOT NULL,
	`probed_at` text NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `media_household_kind_idx` ON `media` (`household_id`,`kind`);
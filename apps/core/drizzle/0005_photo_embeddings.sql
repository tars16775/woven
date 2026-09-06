CREATE TABLE `photo_embeddings` (
	`photo_id` text NOT NULL,
	`model` text NOT NULL,
	`vector` blob NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photo_embeddings_idx` ON `photo_embeddings` (`photo_id`,`model`);
CREATE TABLE `gear_plan_share` (
	`user_id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `gear_plan`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gear_plan_share_slug_unique` ON `gear_plan_share` (`slug`);
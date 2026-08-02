CREATE TABLE `gear_plan` (
	`user_id` text PRIMARY KEY NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`plan_json` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "gear_plan_schema_version_positive" CHECK("gear_plan"."schema_version" >= 1),
	CONSTRAINT "gear_plan_revision_positive" CHECK("gear_plan"."revision" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_provider_id_account_id_unique` ON `account` (`provider_id`,`account_id`);

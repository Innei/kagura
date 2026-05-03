CREATE TABLE `memory_reconcile_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`bucket_key` text NOT NULL,
	`status` text NOT NULL,
	`record_count` integer NOT NULL,
	`raw_response` text,
	`error` text,
	`started_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `memory_reconcile_ops` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`bucket_key` text NOT NULL,
	`kind` text NOT NULL,
	`source_ids` text NOT NULL,
	`target_id` text,
	`payload` text,
	`created_at` text NOT NULL
);

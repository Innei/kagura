CREATE TABLE `memory_reconcile_state` (
	`bucket_key` text PRIMARY KEY NOT NULL,
	`last_reconciled_at` text,
	`last_seen_max_created_at` text,
	`last_count` integer DEFAULT 0 NOT NULL,
	`writes_since_reconcile` integer DEFAULT 0 NOT NULL
);

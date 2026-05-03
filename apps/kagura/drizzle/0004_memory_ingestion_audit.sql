CREATE TABLE `memory_ingestion_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`execution_id` text NOT NULL,
	`final_text_hash` text NOT NULL,
	`status` text NOT NULL,
	`provider_id` text,
	`channel_id` text NOT NULL,
	`thread_ts` text NOT NULL,
	`message_ts` text NOT NULL,
	`repo_id` text,
	`workspace_label` text,
	`input` text NOT NULL,
	`raw_response` text,
	`error` text,
	`started_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `memory_ingestion_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`action` text NOT NULL,
	`status` text NOT NULL,
	`category` text,
	`scope` text,
	`content` text,
	`confidence` real,
	`reason` text,
	`memory_id` text,
	`payload` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `memory_ingestion_runs_execution_idx` ON `memory_ingestion_runs` (`execution_id`);--> statement-breakpoint
CREATE INDEX `memory_ingestion_runs_hash_idx` ON `memory_ingestion_runs` (`final_text_hash`);

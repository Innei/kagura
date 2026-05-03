CREATE TABLE `agent_executions` (
	`execution_id` text PRIMARY KEY NOT NULL,
	`thread_ts` text NOT NULL,
	`channel_id` text NOT NULL,
	`message_ts` text NOT NULL,
	`root_message_ts` text NOT NULL,
	`user_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`status` text NOT NULL,
	`text` text NOT NULL,
	`team_id` text,
	`resume_handle` text,
	`terminal_phase` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`started_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `channel_preferences` (
	`channel_id` text PRIMARY KEY NOT NULL,
	`default_workspace_input` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `memories` (
	`id` text PRIMARY KEY NOT NULL,
	`repo_id` text,
	`thread_ts` text,
	`category` text NOT NULL,
	`content` text NOT NULL,
	`metadata` text,
	`created_at` text NOT NULL,
	`expires_at` text
);
--> statement-breakpoint
CREATE TABLE `review_sessions` (
	`execution_id` text PRIMARY KEY NOT NULL,
	`thread_ts` text NOT NULL,
	`channel_id` text NOT NULL,
	`workspace_path` text NOT NULL,
	`workspace_repo_id` text,
	`workspace_label` text,
	`base_head` text,
	`base_branch` text,
	`head` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session_analytics` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_ts` text NOT NULL,
	`user_id` text,
	`total_cost_usd` real,
	`duration_ms` integer,
	`input_tokens` integer,
	`output_tokens` integer,
	`cache_read_input_tokens` integer,
	`cache_creation_input_tokens` integer,
	`model_usage_json` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `sessions` ADD `agent_provider` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `conversation_mode` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `a2a_lead` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `a2a_team_id` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `a2a_participants_json` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `a2a_pending_assignments` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `a2a_summary_state` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `workspace_repo_id` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `workspace_repo_path` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `workspace_path` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `workspace_label` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `workspace_source` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `last_turn_trigger_ts` text;
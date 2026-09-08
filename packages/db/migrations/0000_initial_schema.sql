CREATE TABLE `admin_notification` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`severity` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`data` text,
	`entity_type` text,
	`entity_id` text,
	`read_at` integer,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `admin_notification_inbox_idx` ON `admin_notification` (`user_id`,`organization_id`,`archived_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_notification_unread_idx` ON `admin_notification` (`user_id`,`organization_id`,`read_at`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`actor_user_id` text,
	`target_user_id` text,
	`type` text NOT NULL,
	`metadata` text,
	`ip` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`target_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_log_target_idx` ON `audit_log` (`organization_id`,`target_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_log_actor_idx` ON `audit_log` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`issuer` text,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `invitation` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`inviter_id` text NOT NULL,
	`assigned_store_ids` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inviter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `member` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`rating` integer,
	`notes` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `member_user_id_idx` ON `member` (`user_id`);--> statement-breakpoint
CREATE INDEX `member_organization_id_idx` ON `member` (`organization_id`);--> statement-breakpoint
CREATE TABLE `organization` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo` text,
	`created_at` integer NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_slug_unique` ON `organization` (`slug`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`active_organization_id` text,
	`impersonated_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text,
	`email_verified` integer DEFAULT false NOT NULL,
	`phone_number` text,
	`phone_number_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text,
	`banned` integer,
	`ban_reason` text,
	`ban_expires` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_phone_number_unique` ON `user` (`phone_number`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `email_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`to` text NOT NULL,
	`from` text,
	`reply_to` text,
	`cc` text,
	`bcc` text,
	`subject` text NOT NULL,
	`html` text,
	`text` text,
	`status` text DEFAULT 'sent' NOT NULL,
	`provider_message_id` text,
	`sent_at` integer NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `email_outbox_to_sent_at_idx` ON `email_outbox` (`to`,`sent_at`);--> statement-breakpoint
CREATE INDEX `email_outbox_sent_at_idx` ON `email_outbox` (`sent_at`);--> statement-breakpoint
CREATE TABLE `notification` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`type` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`data` text,
	`read_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notification_feed_idx` ON `notification` (`user_id`,`organization_id`,`read_at`);--> statement-breakpoint
CREATE INDEX `notification_created_at_idx` ON `notification` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `notification_config` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`notification_key` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`channels` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_config_org_key_uq` ON `notification_config` (`organization_id`,`notification_key`);--> statement-breakpoint
CREATE TABLE `notification_preference` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`channel` text NOT NULL,
	`marketing_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_preference_user_org_channel_uq` ON `notification_preference` (`user_id`,`organization_id`,`channel`);--> statement-breakpoint
CREATE TABLE `organization_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`default_locale` text DEFAULT 'en' NOT NULL,
	`supported_locales` text DEFAULT '["en"]' NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`description` text,
	`primary_color` text,
	`social` text,
	`terms_url` text,
	`privacy_url` text,
	`seo_title` text,
	`seo_description` text,
	`seo_image_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_settings_organization_id_unique` ON `organization_settings` (`organization_id`);--> statement-breakpoint
CREATE INDEX `organization_settings_organization_idx` ON `organization_settings` (`organization_id`);--> statement-breakpoint
CREATE TABLE `push_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`device_token` text NOT NULL,
	`platform` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`data` text,
	`status` text DEFAULT 'sent' NOT NULL,
	`provider_message_id` text,
	`sent_at` integer NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `push_outbox_device_token_sent_at_idx` ON `push_outbox` (`device_token`,`sent_at`);--> statement-breakpoint
CREATE INDEX `push_outbox_sent_at_idx` ON `push_outbox` (`sent_at`);--> statement-breakpoint
CREATE TABLE `push_token` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`platform` text NOT NULL,
	`token` text NOT NULL,
	`device_label` text,
	`is_active` integer DEFAULT true NOT NULL,
	`last_used_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_token_user_org_token_uq` ON `push_token` (`user_id`,`organization_id`,`token`);--> statement-breakpoint
CREATE INDEX `push_token_user_idx` ON `push_token` (`user_id`);--> statement-breakpoint
CREATE INDEX `push_token_org_platform_idx` ON `push_token` (`organization_id`,`platform`);--> statement-breakpoint
CREATE TABLE `shortlink` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`target_url` text NOT NULL,
	`organization_id` text NOT NULL,
	`click_count` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by_user_id` text,
	`campaign_id` text,
	`recipient_id` text,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shortlink_slug_uq` ON `shortlink` (`slug`);--> statement-breakpoint
CREATE INDEX `shortlink_org_target_idx` ON `shortlink` (`organization_id`,`target_url`);--> statement-breakpoint
CREATE INDEX `shortlink_org_created_idx` ON `shortlink` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `shortlink_campaign_idx` ON `shortlink` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `shortlink_click` (
	`id` text PRIMARY KEY NOT NULL,
	`shortlink_id` text NOT NULL,
	`clicked_at` integer NOT NULL,
	`country` text,
	`city` text,
	`user_agent` text,
	`referer` text,
	FOREIGN KEY (`shortlink_id`) REFERENCES `shortlink`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shortlink_click_link_clicked_idx` ON `shortlink_click` (`shortlink_id`,`clicked_at`);--> statement-breakpoint
CREATE TABLE `sms_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`to` text NOT NULL,
	`from` text,
	`content` text NOT NULL,
	`encoding` text DEFAULT 'GSM-7' NOT NULL,
	`segments` integer DEFAULT 1 NOT NULL,
	`characters` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'sent' NOT NULL,
	`provider_message_id` text,
	`sent_at` integer NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `sms_outbox_to_sent_at_idx` ON `sms_outbox` (`to`,`sent_at`);--> statement-breakpoint
CREATE INDEX `sms_outbox_sent_at_idx` ON `sms_outbox` (`sent_at`);--> statement-breakpoint
CREATE TABLE `whatsapp_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`to` text NOT NULL,
	`from` text,
	`content` text NOT NULL,
	`content_sid` text,
	`content_variables` text,
	`media_url` text,
	`status` text DEFAULT 'sent' NOT NULL,
	`provider_message_id` text,
	`sent_at` integer NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `whatsapp_outbox_to_sent_at_idx` ON `whatsapp_outbox` (`to`,`sent_at`);--> statement-breakpoint
CREATE INDEX `whatsapp_outbox_sent_at_idx` ON `whatsapp_outbox` (`sent_at`);
CREATE TABLE `gather_players` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`seat` integer NOT NULL,
	`votes` text
);
--> statement-breakpoint
CREATE TABLE `gather_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`access_hash` text NOT NULL,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`location` text NOT NULL,
	`category` text NOT NULL,
	`seats` integer NOT NULL,
	`picks` text NOT NULL,
	`created` integer NOT NULL,
	`expires` integer NOT NULL
);

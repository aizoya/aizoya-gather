CREATE TABLE `api_budget` (
	`scope` text PRIMARY KEY NOT NULL,
	`period` integer NOT NULL,
	`used` integer NOT NULL
);

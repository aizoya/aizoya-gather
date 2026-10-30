CREATE TABLE `api_budget_gate` (
	`id` integer PRIMARY KEY NOT NULL,
	`second` integer NOT NULL,
	`second_used` integer NOT NULL,
	`minute` integer NOT NULL,
	`minute_used` integer NOT NULL,
	`day` integer NOT NULL,
	`day_used` integer NOT NULL
);

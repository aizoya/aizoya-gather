CREATE INDEX `gather_players_room_idx` ON `gather_players` (`room_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `gather_players_room_seat_unique` ON `gather_players` (`room_id`,`seat`);
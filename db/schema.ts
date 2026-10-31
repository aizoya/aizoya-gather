import {sqliteTable,text,integer,index,uniqueIndex} from 'drizzle-orm/sqlite-core';
// Exactly three global counter rows; no visitor identities or tastes are stored.
export const apiBudget=sqliteTable('api_budget',{
 scope:text('scope').primaryKey(),
 period:integer('period').notNull(),
 used:integer('used').notNull(),
});
// Global all-window gate. Existing migration-owned api_budget is retained.
export const apiBudgetGate=sqliteTable('api_budget_gate',{
 id:integer('id').primaryKey(),second:integer('second').notNull(),secondUsed:integer('second_used').notNull(),
 minute:integer('minute').notNull(),minuteUsed:integer('minute_used').notNull(),day:integer('day').notNull(),dayUsed:integer('day_used').notNull(),
});
// Private invitation rooms; only cultural selections reach Qloo.
export const gatherRooms=sqliteTable('gather_rooms',{
 id:text('id').primaryKey(),accessHash:text('access_hash').notNull(),title:text('title').notNull(),date:text('date').notNull(),location:text('location').notNull(),category:text('category').notNull(),discoveryMode:text('discovery_mode').notNull().default('events'),seats:integer('seats').notNull(),picks:text('picks').notNull(),rejected:text('rejected').notNull().default('[]'),created:integer('created').notNull(),expires:integer('expires').notNull(),
});
export const gatherPlayers=sqliteTable('gather_players',{
 id:text('id').primaryKey(),roomId:text('room_id').notNull(),tokenHash:text('token_hash').notNull(),seat:integer('seat').notNull(),votes:text('votes'),preferences:text('preferences'),
},table=>[index('gather_players_room_idx').on(table.roomId),uniqueIndex('gather_players_room_seat_unique').on(table.roomId,table.seat)]);

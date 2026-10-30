import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
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

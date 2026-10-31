import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {reserveDiscovery} from '../lib/discovery-budget.mjs';
test('approved extension permits eight additional two-call reservations and then fails closed',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE api_budget_gate(id INTEGER PRIMARY KEY,second INTEGER,second_used INTEGER,minute INTEGER,minute_used INTEGER,day INTEGER,day_used INTEGER);INSERT INTO api_budget_gate VALUES(2,0,0,0,0,0,14)');
 const db={prepare(query){return {async first(){return sql.prepare(query).get()||null;}}}};
 for(let i=0;i<8;i++)await reserveDiscovery(db);
 assert.equal(sql.prepare('SELECT day_used FROM api_budget_gate WHERE id=2').get().day_used,30);
 await assert.rejects(reserveDiscovery(db),/capped discovery allowance/);
 assert.equal(sql.prepare('SELECT day_used FROM api_budget_gate WHERE id=2').get().day_used,30);
 await assert.rejects(reserveDiscovery(null),/limiter is unavailable/);sql.close();
});

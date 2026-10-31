import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {RESERVE_SQL,reserve,budgetedFetch} from '../lib/budget.mjs';
test('atomic reservation does not charge other windows on denial and rolls over safely',()=>{
 const run=spawnSync('python3',['-c',`import sqlite3,sys
sql=sys.stdin.read();db=sqlite3.connect(':memory:')
db.execute('CREATE TABLE api_budget_gate(id INTEGER PRIMARY KEY,second INTEGER NOT NULL,second_used INTEGER NOT NULL,minute INTEGER NOT NULL,minute_used INTEGER NOT NULL,day INTEGER NOT NULL,day_used INTEGER NOT NULL)')
def reserve(s,m=1,d=1):return db.execute(sql,(s,m,d)).fetchall()
assert reserve(10)==[(1,1,1)]
assert reserve(10)==[(2,2,2)]
assert reserve(10)==[(3,3,3)]
assert reserve(10)==[]
assert db.execute('SELECT minute_used,day_used FROM api_budget_gate').fetchone()==(3,3)
assert reserve(11)==[(1,4,4)]
assert reserve(9)==[]
db.execute('UPDATE api_budget_gate SET minute_used=60')
assert reserve(12)==[]
assert db.execute('SELECT second,day_used FROM api_budget_gate').fetchone()==(11,4)
assert reserve(12,2)==[(1,1,5)]
db.execute('UPDATE api_budget_gate SET day_used=1000')
assert reserve(13,3)==[]
assert reserve(13,3,2)==[(1,1,1)]
assert db.execute('SELECT COUNT(*) FROM api_budget_gate').fetchone()[0]==1`],{input:RESERVE_SQL,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
});
test('missing database prevents upstream calls',async()=>{let calls=0;await assert.rejects(budgetedFetch(null,async()=>{calls++;})('https://example.com'),/limiter/);assert.equal(calls,0);});
test('database errors fail closed',async()=>{await assert.rejects(reserve({prepare(){throw Error('db unavailable');}}),/No Qloo request/);});
const dbFor=fn=>({prepare(sql){return {bind(){return {first:()=>fn(sql)};},first:()=>fn(sql)};}});
test('daily denial prevents upstream calls without waiting',async()=>{let calls=0,waits=0;const now=120000;const db=dbFor(sql=>sql.startsWith('INSERT')?null:{day:0,day_used:1000,minute:2,minute_used:1,second:120,second_used:1});await assert.rejects(budgetedFetch(db,async()=>calls++,{clock:()=>now,wait:async()=>waits++})('https://example.com'),/limit was reached/);assert.equal(calls,0);assert.equal(waits,0);});
test('burst reservation waits to next window before one upstream call',async()=>{let now=1500,calls=0,attempts=0;const db=dbFor(sql=>sql.startsWith('INSERT')?(++attempts===1?null:{second_used:1}):{second:1,second_used:3,minute:0,minute_used:3,day:0,day_used:3});await budgetedFetch(db,async()=>calls++,{clock:()=>now,wait:async ms=>{assert(ms<=1025);now+=ms;}})('https://example.com');assert.equal(attempts,2);assert.equal(calls,1);});
test('persistent burst contention stops after two waits',async()=>{let waits=0,calls=0;const db=dbFor(sql=>sql.startsWith('INSERT')?null:{second:1,second_used:3,minute:0,minute_used:3,day:0,day_used:3});await assert.rejects(budgetedFetch(db,async()=>calls++,{clock:()=>1500,wait:async()=>{waits++;}})('https://example.com'),/limit was reached/);assert.equal(waits,2);assert.equal(calls,0);});
test('abort while waiting prevents upstream traffic',async()=>{const controller=new AbortController();const db=dbFor(sql=>sql.startsWith('INSERT')?null:{second:1,second_used:3,minute:0,minute_used:3,day:0,day_used:3});let calls=0;await assert.rejects(budgetedFetch(db,async()=>calls++,{clock:()=>1500,wait:async()=>controller.abort()})('https://example.com',{signal:controller.signal}));assert.equal(calls,0);});

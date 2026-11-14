import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/index.js';

async function client(url,token){const socket=new WebSocket(url),pending=new Map(),snapshots=[];let count=0;socket.on('message',raw=>{const message=JSON.parse(String(raw));if(message.type==='snapshot')snapshots.push(message.data);if(message.id&&pending.has(message.id)){const{resolve,reject}=pending.get(message.id);pending.delete(message.id);message.ok?resolve(message.result):reject(Error(message.error));}});await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject)});const request=(action,payload={},id=`request-${++count}`)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error(`Timed out ${action}`));},5000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});socket.send(JSON.stringify({id,action,payload}));});await request('auth',{token});return{socket,request,snapshots,close:()=>new Promise(resolve=>{socket.once('close',resolve);socket.close()})};}

test('two real WebSocket clients join, see movement, trade, and replay a purchase without double charge',async()=>{
 const app=createGameServer({database:':memory:',tickInterval:50,broadcastInterval:50});const address=await app.listen(0,'127.0.0.1'),url=`http://127.0.0.1:${address.port}`;let first,second;
 try{
  const health=await(await fetch(`${url}/api/health`)).json();assert.equal(health.ok,true);
  const a=await(await fetch(`${url}/api/session`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Ada'})})).json();
  const b=await(await fetch(`${url}/api/session`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Bryn'})})).json();
  first=await client(url.replace('http','ws')+'/socket',a.token);second=await client(url.replace('http','ws')+'/socket',b.token);
  const room=await first.request('room.create',{name:'Two Real Travelers'});const joined=await second.request('room.join',{code:room.room.code});assert.equal(joined.players.filter(p=>p.connected).length,2);
  const purchase={method:'purchase',args:['draught',1,'buy']};await first.request('command',purchase,'one-purchase');await first.request('command',purchase,'one-purchase');const snap=await first.request('snapshot');assert.equal(snap.game.player.inventory.draught,4);assert.equal(snap.game.player.goodKarma,100);
  await assert.rejects(()=>first.request('command',{method:'setPlayer',args:[{goodKarma:100000}]}),/not available/);
  await first.request('input',{sequence:1,keys:['d']});await new Promise(resolve=>setTimeout(resolve,350));await first.request('input',{sequence:2,keys:[]});const moved=await second.request('snapshot');assert.ok(moved.players.find(p=>p.id===a.id).x>920);
  const trade=await first.request('trade.invite',{targetId:b.id});await first.request('trade.offer',{id:trade.id,offer:{items:{draught:1}}});await second.request('trade.offer',{id:trade.id,offer:{goodKarma:10}});await first.request('trade.lock',{id:trade.id});await second.request('trade.lock',{id:trade.id});await first.request('trade.confirm',{id:trade.id});await second.request('trade.confirm',{id:trade.id});
  const final=await first.request('snapshot');assert.equal(final.game.player.inventory.draught,3);assert.equal(final.game.player.goodKarma,110);assert.equal(final.receipts.filter(r=>r.type==='player-trade').length,1);assert.ok(first.snapshots.length>0);assert.ok(second.snapshots.length>0);
 }finally{await first?.close();await second?.close();await app.close();}
});

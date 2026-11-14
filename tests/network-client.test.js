import test from 'node:test';
import assert from 'node:assert/strict';
import { NetworkClient } from '../src/network/NetworkClient.js';

function fixture() {
  const solo={version:1,zoneId:'sacred-groves',player:{name:'Solo',lineage:'angel',health:100,rank:1,inventory:{draught:3}},selectedPower:{branchId:'water-grow',level:1}};
  const originalStore={value:JSON.stringify(solo),getItem(){return this.value},setItem(_,value){this.value=value},removeItem(){this.value=null}};
  const e={storage:originalStore,player:structuredClone(solo.player),zone:{id:solo.zoneId},world:{seed:17},entities:[],keys:new Set(),pointer:{x:1,y:2},selectedPower:structuredClone(solo.selectedPower),shop:{activeQuote:null},update(){this.updated=true},getSnapshot(){return{player:this.player,zone:this.zone}},save(){this.storage.setItem('save',JSON.stringify({version:1,player:this.player,zoneId:this.zone.id}));return true},exportCheckpoint(){return JSON.parse(this.storage.getItem('save'))},restoreCheckpoint(c){this.storage.setItem('save',JSON.stringify(c));this.player=structuredClone(c.player);this.zone={id:c.zoneId};return true},publish(){this.published=this.getSnapshot()},setPower(branchId,level){this.selectedPower={branchId,level}},selectTarget(id){this.targetId=id},previewTrade(itemId,quantity,mode){const q={id:'local-quote',itemId,quantity,mode,total:25};this.shop.activeQuote=q;return q},commitTrade(){return false},cast(){this.castLocally=true}};
  const client=new NetworkClient(e);client.command=(method,args)=>{client.lastCommand={method,args};return Promise.resolve(true)};
  return{client,e,solo,originalStore};
}
function snapshot(value=25){return{status:'connected',room:{code:'ABC123',name:'Shared',capacity:4},selfId:'self',role:'owner',players:[{id:'self',name:'Shared'}],game:{player:{name:'Shared',lineage:'angel',health:90,rank:1,inventory:{draught:1},goodKarma:value},zone:{id:'sacred-groves'},time:4,selectedPower:{branchId:'water-grow',level:1}},checkpoint:{version:1,zoneId:'sacred-groves',player:{name:'Shared',lineage:'angel',health:90,rank:1,inventory:{draught:1},goodKarma:value}},world:{seed:17},entities:[],effects:[],targetId:null,destination:null,trades:[],chat:[],market:[]}}

test('shared snapshots use a separate store and disconnect restores the solo journey',()=>{
 const{client,e,originalStore}=fixture();const bytes=originalStore.value;client.applySnapshot(snapshot());assert.equal(e.player.name,'Shared');assert.equal(originalStore.value,bytes);assert.notEqual(e.storage,originalStore);assert.equal(e.network.room.code,'ABC123');client.detach();assert.equal(e.player.name,'Solo');assert.equal(e.player.inventory.draught,3);assert.equal(e.storage,originalStore);assert.equal(originalStore.value,bytes);
});
test('the client sends cast intent rather than resolving resource changes locally',async()=>{
 const{client,e}=fixture();client.applySnapshot(snapshot());await e.cast();assert.deepEqual(client.lastCommand,{method:'cast',args:[]});assert.equal(e.castLocally,undefined);assert.equal(e.player.goodKarma,25);client.detach();
});
test('a posted vendor quote survives intervening snapshots and settles through server repricing',async()=>{
 const{client,e}=fixture();client.applySnapshot(snapshot());const q=e.previewTrade('draught',1,'buy');client.applySnapshot(snapshot());await e.commitTrade(q.id);assert.deepEqual(client.lastCommand,{method:'purchase',args:['draught',1,'buy',{total:25}]});client.detach();
});
test('static terrain is cached while fresh authoritative entities and effects arrive',()=>{
 const{client,e}=fixture();client.applySnapshot(snapshot());const first=e.world;const next=snapshot(31);next.world={seed:17};next.entities=[{id:'one',x:20,y:30}];client.applySnapshot(next);assert.equal(e.world,first);assert.equal(e.entities[0].id,'one');assert.equal(e.player.goodKarma,31);client.detach();
});
test('paused menus send blocked input without pausing the authoritative room',()=>{
 const{client,e}=fixture();e.paused=true;e.keys.add('d');const input=client.captureInput();assert.equal(input.blocked,true);assert.deepEqual(input.keys,['d']);assert.equal(input.sequence,1);
});

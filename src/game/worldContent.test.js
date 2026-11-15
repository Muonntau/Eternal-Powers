import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ZONES } from '../data/manual.js';
import { createWorld } from './renderer.js';
import { AUTHORED_LAYOUTS, CAMPAIGN_CHAPTERS, getZoneLayout, getAuthoredCampaign, getZoneEntityLayout, decorateZoneWorld, createWorldEntities, isWorldBlocked, hasWorldLineOfEffect, findAuthoredRoute } from './worldContent.js';

test('all 39 manual regions have distinct authored routes and three individually named contracts', () => {
 assert.equal(Object.keys(AUTHORED_LAYOUTS).length, 39);
 const signatures = new Set(), objectives = [], titles = new Set();
 for (const zone of ZONES) {
  const layout = getZoneLayout(zone), campaign = getAuthoredCampaign(zone);
  assert.equal(campaign.zoneId, zone.id);
  assert.equal(campaign.objectives.length, 3, zone.name);
  assert.ok(layout.landmarks.length >= 3, zone.name);
  signatures.add(JSON.stringify(layout.paths.filter(path=>!path.hidden).map(path=>path.points)));
  for (const contract of campaign.objectives) {
   assert.ok(contract.steps.length > 0, contract.title);
   assert.ok(contract.description.length > 20, contract.title);
   assert.ok(contract.reward.amount > 0, contract.title);
   titles.add(contract.title); objectives.push(contract);
  }
 }
 assert.equal(signatures.size, 39);
 assert.equal(objectives.length, 117);
 assert.equal(new Set(objectives.map(c=>c.id)).size, 117);
 assert.equal(titles.size, 117);
 const ids = new Set(objectives.map(c=>c.id));
 for(const objective of objectives)for(const prerequisite of objective.prerequisites)assert.ok(ids.has(prerequisite), `${objective.id}: ${prerequisite}`);
 assert.equal(objectives.filter(c=>c.ending).length, 1);
 const ending=objectives.find(c=>c.ending);assert.equal(ending.requiredRank,10);
 for(const chapter of CAMPAIGN_CHAPTERS)assert.ok(ids.has(chapter.keyObjective));
});

test('every campaign step and critical encounter has a continuous ground route from its safe hub', () => {
 for (const zone of ZONES) {
  const world = getZoneLayout(zone), campaign = getAuthoredCampaign(zone);
  const anchors = [...campaign.objectives.flatMap(contract=>contract.steps), ...Object.entries(getZoneEntityLayout(zone)).map(([id,position])=>({id,...position}))];
  for (const anchor of anchors) {
   assert.equal(isWorldBlocked(world,anchor.x,anchor.y,{ignoreProps:true}),false,`${zone.id}: ${anchor.name||anchor.id} is occupied`);
   assert.ok(findAuthoredRoute(world,world.spawn,anchor).length,`${zone.id}: ${anchor.name||anchor.id} cannot be reached on foot`);
  }
 }
});

test('Sacred Groves preserves the first-session anchors and the owned sanctuary plot', () => {
 const zone=ZONES.find(z=>z.id==='sacred-groves'),world=decorateZoneWorld(createWorld(17,'forest'),zone);
 assert.equal(world.legacy,false);
 assert.equal(world.authored,true);
 assert.equal(world.layoutVersion,2);
 assert.deepEqual(world.spawn,{x:920,y:900});
 assert.deepEqual(getZoneEntityLayout(zone),{});
 assert.equal(world.props.some(p=>p.radius>0&&p.x>=350&&p.x<=650&&p.y>=450&&p.y<=750),false);
 assert.equal(isWorldBlocked(world,1420+Math.sin(600/230)*75,600,{ignoreProps:true}),true);
 assert.equal(isWorldBlocked(world,1420+Math.sin(600/230)*75,600,{ignoreProps:true,flying:true}),false);
 assert.equal(isWorldBlocked(world,1360,930,{ignoreProps:true}),false);
});

test('all generated architecture and actually placed imported scenery resolve to shipped files', () => {
 let imported=0;
 for(const zone of ZONES){
  const world=decorateZoneWorld(createWorld(911,'forest'),zone);
  for(const prop of world.props){if(!prop.asset)continue;assert.ok(existsSync(resolve('public/assets',prop.asset+'.png')),`${zone.id}: ${prop.asset}`);if(prop.asset.startsWith('vendor/'))imported++;}
  const portal=createWorldEntities(zone).find(e=>e.role==='route-portal');assert.ok(portal);
  assert.ok(ZONES.some(z=>z.id===portal.destination));
  assert.ok(existsSync(resolve('public/assets',portal.asset+'-sheet.png')));
 }
 assert.ok(imported>25,'licensed scenery must be placed in worlds, not merely bundled');
});

test('world collision and spell cover distinguish water, flight and solid interior walls', () => {
 const world={width:1000,height:1000,terrain:{water:[{points:[{x:100,y:100},{x:300,y:100},{x:300,y:300},{x:100,y:300}]}],bridges:[{x:95,y:180,width:210,height:40}],walls:[{x:400,y:100,width:20,height:300,solid:true}],cliffs:[{x:100,y:500,width:200,height:30}]},props:[]};
 assert.equal(isWorldBlocked(world,150,150),true);assert.equal(isWorldBlocked(world,150,150,{flying:true}),false);
 assert.equal(isWorldBlocked(world,150,200),false);assert.equal(isWorldBlocked(world,410,200,{flying:true}),true);
 assert.equal(isWorldBlocked(world,150,515),true);assert.equal(isWorldBlocked(world,150,515,{flying:true}),false);
 assert.equal(hasWorldLineOfEffect(world,{x:350,y:200},{x:500,y:200}),false);
 assert.equal(hasWorldLineOfEffect(world,{x:100,y:200},{x:300,y:200}),true);
});

test('cached campaign and layout metadata cannot be changed by a consumer', () => {
 const zone=ZONES.find(z=>z.id==='ethereal-libraries'),campaign=getAuthoredCampaign(zone),layout=getZoneLayout(zone),positions=getZoneEntityLayout(zone);
 const originalName=campaign.objectives[0].steps[0].name,originalX=layout.paths[0].points[0].x,originalKeeper=positions.keeper.x;
 campaign.objectives[0].steps[0].name='changed';layout.paths[0].points[0].x=-10000;positions.keeper.x=-10000;
 assert.equal(getAuthoredCampaign(zone).objectives[0].steps[0].name,originalName);
 assert.equal(getZoneLayout(zone).paths[0].points[0].x,originalX);
 assert.equal(getZoneEntityLayout(zone).keeper.x,originalKeeper);
});


test('portal anchor access has an explicit reachable authored trial and posted grant', () => {
 const campaign=getAuthoredCampaign('infernal-gates'),trial=campaign.objectives.find(o=>o.grantsPortalAccess);
 assert.ok(trial);assert.match(trial.title,/Portal Access Trial/);assert.match(trial.description,/portal anchor/);
 assert.equal(trial.steps.at(-1).grantsPortalAccess,true);
 assert.ok(trial.steps.every(step=>step.type==='mechanism'&&step.sequence.length===3));
 const world=getZoneLayout('infernal-gates');for(const step of trial.steps)assert.ok(findAuthoredRoute(world,world.spawn,step).length);
});


test('v2 expands every region fourfold with distinct districts and real accessible architecture', () => {
 const names=new Set(), signatures=new Set();
 for(const zone of ZONES){
  const world=getZoneLayout(zone);
  assert.equal(world.authored,true,zone.id);assert.equal(world.legacy,false,zone.id);
  assert.ok(world.width*world.height>=2400*1800*4,zone.id);
  assert.equal(world.districts.length,6,zone.id);
  assert.equal(world.discoverySites.length,6,zone.id);
  assert.ok(world.architecturalFeatures.length>=12,zone.id);
  assert.equal(world.interiors.filter(r=>r.expansion).length,3,zone.id);
  signatures.add(JSON.stringify(world.districts.map(d=>[d.name,d.theme])));
  for(const d of world.districts){
   names.add(d.name);
   assert.ok(d.x>2400||d.y>1800,`${zone.id}: district must open new territory`);
   assert.ok(findAuthoredRoute(world,world.spawn,d).length,`${zone.id}: ${d.name} requires a ground route`);
  }
  for(const room of world.interiors.filter(r=>r.expansion)){
   const inside={x:room.x+room.width/2,y:room.y+room.height-70};
   assert.equal(isWorldBlocked(world,inside.x,inside.y,{ignoreProps:true}),false,room.name);
   assert.ok(findAuthoredRoute(world,world.spawn,inside).length,`${zone.id}: ${room.name} needs an enterable doorway`);
  }
 }
 assert.equal(signatures.size,39);assert.ok(names.size>200,'districts are individually named places');
});

test('frontier habitats and renewable materials populate reachable new territory without story duplicates', () => {
 for(const zone of ZONES){
  const world=getZoneLayout(zone),entities=createWorldEntities(zone);
  const resources=entities.filter(e=>e.kind==='resource'&&e.renewable),monsters=entities.filter(e=>e.kind==='enemy'&&e.renewable);
  assert.equal(resources.length,96,zone.id);assert.equal(monsters.length,18,zone.id);
  assert.equal(new Set(entities.map(e=>e.id)).size,entities.length,zone.id);
  assert.ok(resources.every(e=>e.respawnSeconds===90&&['herb','crystal','wood','stone'].includes(e.item)));
  assert.ok(monsters.every(e=>e.respawnSeconds===120&&!e.boss&&!e.worldBoss&&e.creatureId&&e.profiledEncounter));
  assert.ok([...resources,...monsters].every(e=>(e.x>2400||e.y>1800)&&!isWorldBlocked(world,e.x,e.y,{ignoreProps:true})),zone.id);
  for(const habitat of world.habitats)assert.ok(findAuthoredRoute(world,world.spawn,habitat).length,`${zone.id}: habitat ${habitat.id}`);
  for(const e of resources.filter((_,i)=>i%16===0))assert.ok(findAuthoredRoute(world,world.spawn,e).length,`${zone.id}: ${e.id}`);
 }
});

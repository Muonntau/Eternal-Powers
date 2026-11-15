import { mkdir, writeFile } from 'node:fs/promises';
import { ZONES } from '../src/data/manual.js';

const out = new URL('../public/assets/v2/regions/', import.meta.url);
await mkdir(out, { recursive: true });
const hash = value => [...value].reduce((n,c) => (n * 31 + c.charCodeAt(0)) >>> 0, 17);
function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }
const escape = text => text.replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
for (const zone of ZONES) {
 const random = rng(hash(zone.id)), name=zone.name.toLowerCase(), hell=zone.realm==='hell', heaven=zone.realm==='heaven';
 const desert=/desert|pyramid|dune/.test(name), water=/water|lake|bay|river|waterfall/.test(name), city=/city|market|settlement|librar|observator|temple|cathedral/.test(name), mountain=/mountain|peak|chasm/.test(name);
 const palette=hell?['#090c20','#342342','#934b79','#f48b9e','#a79af8']:heaven?['#0b1630','#2e4168','#7779bc','#9df0ff','#e2d8ff']:desert?['#15132b','#493749','#956778','#ffd0a0','#a797eb']:water?['#061a2b','#17465a','#3991a7','#9aecf2','#b1aeed']:['#091729','#203b50','#3e706f','#80e4d5','#a5abef'];
 let shapes='';
 for(let i=0;i<80;i++) {const x=random()*1200,y=random()*340,r=.5+random()*1.4;shapes+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${palette[4]}" opacity="${(.12+random()*.45).toFixed(2)}"/>`;}
 const moonX=180+random()*820;shapes+=`<circle cx="${moonX}" cy="135" r="53" fill="url(#moon)"/><circle cx="${moonX}" cy="135" r="30" fill="none" stroke="${palette[3]}" stroke-opacity=".25"/><path d="M0 325Q170 205 320 315T620 285T910 270T1200 300V600H0Z" fill="${palette[1]}" opacity=".58"/>`;
 shapes+=`<path d="M0 400L110 330L215 365L335 275L480 390L650 300L820 385L1010 260L1200 365V600H0Z" fill="${palette[1]}"/><path d="M0 477Q300 373 600 450T1200 421V600H0Z" fill="${palette[2]}" opacity=".44"/>`;
 const arches=(x,y,scale=1)=>`<g transform="translate(${x} ${y}) scale(${scale})"><path d="M-70 0V-112Q0-230 70-112V0H43V-105Q0-175-43-105V0Z" fill="${palette[2]}"/><path d="M-52-8V-106Q0-192 52-106V-8" fill="none" stroke="${palette[3]}" stroke-opacity=".75" stroke-width="3"/><path d="M-85 0H85L112 18H-110Z" fill="${palette[1]}"/><ellipse cy="-88" rx="38" ry="70" fill="url(#portal)"/></g>`;
 if (city || heaven || hell) {
  for(let i=0;i<7;i++){const x=280+i*100,y=420+Math.sin(i)*18,h=95+random()*130;shapes+=`<g><path d="M${x-22} ${y}V${y-h}L${x} ${y-h-42}L${x+22} ${y-h}V${y}Z" fill="${i%2?palette[1]:palette[2]}"/><path d="M${x} ${y-h-25}V${y-12}" stroke="${palette[3]}" stroke-opacity=".5"/><rect x="${x-7}" y="${y-h+28}" width="14" height="38" rx="7" fill="${palette[4]}" opacity=".7"/></g>`;}
  shapes+=arches(600,435,1.25);
  if(heaven)shapes+=`<ellipse cx="600" cy="208" rx="270" ry="24" fill="none" stroke="${palette[3]}" stroke-width="3" opacity=".6"/><path d="M340 460L600 540L865 460" fill="${palette[1]}"/><path d="M390 467L600 510L815 466" fill="none" stroke="${palette[4]}" opacity=".4"/>`;
 } else if(desert) {
  shapes+=`<path d="M160 458L390 162L620 458Z" fill="${palette[2]}"/><path d="M390 162L620 458L390 410Z" fill="${palette[1]}"/><path d="M250 350L390 173L520 350M211 400H565" fill="none" stroke="${palette[3]}" stroke-opacity=".5" stroke-width="3"/>`+arches(820,452,.75);
 } else if(water) {
  shapes+=`<path d="M620 315C590 390 810 390 780 490C650 555 430 512 360 600H750C780 540 925 500 900 450C870 385 650 390 685 315Z" fill="${palette[2]}"/><path d="M651 318C610 385 850 405 832 466C817 514 530 529 500 600" fill="none" stroke="${palette[3]}" stroke-width="13" opacity=".7"/>`+arches(425,422,.8);
 } else {
  shapes+=arches(600,440,1.2);
  for(let i=0;i<13;i++){const x=i<7?70+i*56:850+(i-7)*55,y=440+random()*70,h=90+random()*125;shapes+=`<path d="M${x-6} ${y}V${y-h}M${x} ${y-h+20}L${x-38} ${y-h+65}M${x} ${y-h+45}L${x+35} ${y-h+78}" stroke="${palette[1]}" stroke-width="11"/><ellipse cx="${x}" cy="${y-h+40}" rx="${24+random()*22}" ry="${45+random()*35}" fill="${palette[2]}" opacity=".75"/>`;}
 }
 if(mountain) shapes+=`<path d="M0 530L170 140L355 530Z" fill="${palette[1]}"/><path d="M170 140L120 265L172 235L215 270Z" fill="${palette[4]}" opacity=".6"/>`;
 shapes+=`<path d="M0 570Q300 460 585 480T1200 550V600H0Z" fill="${palette[0]}" opacity=".82"/><path d="M512 600L585 480H626L750 600Z" fill="${palette[2]}" opacity=".62"/><path d="M590 600L606 480" stroke="${palette[3]}" opacity=".5" stroke-width="3"/>`;
 for(let i=0;i<18;i++){const x=random()*1200,y=435+random()*150;shapes+=`<path d="M${x} ${y-16}L${x+5} ${y}L${x} ${y+10}L${x-5} ${y}Z" fill="${palette[3]}" opacity="${(.2+random()*.5).toFixed(2)}"/>`;}
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600" role="img"><title>${escape(zone.name)} — v2 region illustration</title><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${palette[0]}"/><stop offset="1" stop-color="${palette[1]}"/></linearGradient><radialGradient id="moon"><stop stop-color="${palette[3]}" stop-opacity=".75"/><stop offset=".45" stop-color="${palette[3]}" stop-opacity=".12"/><stop offset="1" stop-color="${palette[3]}" stop-opacity="0"/></radialGradient><radialGradient id="portal"><stop stop-color="${palette[3]}" stop-opacity=".55"/><stop offset="1" stop-color="${palette[4]}" stop-opacity=".02"/></radialGradient><linearGradient id="shade" x2="0" y2="1"><stop stop-color="${palette[0]}" stop-opacity="0"/><stop offset="1" stop-color="${palette[0]}" stop-opacity=".45"/></linearGradient></defs><path fill="url(#sky)" d="M0 0H1200V600H0Z"/>${shapes}<path fill="url(#shade)" d="M0 0H1200V600H0Z"/></svg>`;
 await writeFile(new URL(`${zone.id}.svg`,out),svg);
}
await writeFile(new URL('../public/assets/v2/ART_LICENSE.txt',import.meta.url),'Original Eternal Powers v2 graphics, including the generated portal/realm character-creator backdrop and generated SVG region illustrations. Released under CC0 1.0. Region illustration source: scripts/generate-v2-regions.mjs. Existing imported assets retain their separate licenses.\n');
console.log(`Generated ${ZONES.length} original v2 region illustrations.`);

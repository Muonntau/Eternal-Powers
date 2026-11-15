/** V2 frontier districts extend the preserved campaign heart into a full region. */
export const REGION_SIZE = { width: 4800, height: 3600 };

const DISTRICTS = {
  'ethereal-sanctuary': ['Dawnward Cloister', 'The Lucent Orrery', 'Silverwing Promenade', 'The Cloud Conservatory', 'Pilgrim Lantern Court', 'The Quiet Horizon'],
  'divine-cities': ['The Aureate Exchange', 'Senate of the High Sky', 'The Aqueduct Quarter', 'The Gilded Colonnade', 'Artificers’ Borough', 'The Westward Watch'],
  'halls-of-knowledge': ['The Grand Scriptorium', 'The Mnemonic Orrery', 'The Inquiry Forum', 'The Living Catalogue', 'Apprentices’ Quarter', 'The Unwritten Terrace'],
  'ethereal-libraries': ['The Glass Archive', 'The Astral Index', 'The Whispering Stacks', 'The Garden of Marginalia', 'The Bookbinders’ Court', 'The Last Reading Room'],
  'ethereal-gardens': ['The Pearl Conservatory', 'The Starflower Canopy', 'The Hanging Orchards', 'The Moonwater Pavilion', 'Gardeners’ Commons', 'The Petal Outlook'],
  'celestial-waterfalls': ['The Mistwater Arcade', 'The Crown Cascade', 'The Luminous Spillway', 'The Veiled Pools', 'The Sprayward Hamlet', 'The Rainbow Overlook'],
  'palatial-halls': ['The Ivory Procession', 'The Imperial Astrolabe', 'The Glass Audience', 'The Tranquil Menagerie', 'The Envoys’ Court', 'The Balcony of Winds'],
  'celestial-palaces': ['The Opaline Avenue', 'The Solar Pavilion', 'The Argent Ramparts', 'The Emperor’s Reflection', 'The Court of Banners', 'The Horizon Throne'],
  'astral-observatory': ['The Meridian Causeway', 'The Great Orrery', 'The Falling-Star Array', 'The Eclipse Basin', 'The Lenswright Quarter', 'The Distant Zenith'],
  'celestial-observatories': ['The Four-Winds Gallery', 'The Infinite Astrolabe', 'The Lunar Instrument', 'The Nebula Reflection', 'The Surveyors’ Borough', 'The Concordant Zenith'],
  'eternal-light-fields': ['The Dawnglass Walk', 'The Heliograph Tower', 'The Sunward Meadows', 'The Golden Respite', 'The Lamplighters’ Court', 'The Evening Prism'],
  'iridescent-temples': ['The Prism Procession', 'The Sevenfold Sanctum', 'The Mirror Bell Court', 'The Azure Lotus Garden', 'The Mosaic Quarter', 'The Opalescent Summit'],
  'translucent-bridges': ['The Crystal Approach', 'The Suspended Spire', 'The Azure Crossing', 'The Glasswater Basin', 'The Spanwright Court', 'The Far Anchorage'],
  'celestial-sanctuaries': ['The Wayfarer Arcade', 'The Beacon Tower', 'The Hearthward Grove', 'The Restful Lake', 'The Builders’ Commons', 'The Open Horizon'],
  'majestic-mountain-ranges': ['The Granite Causeway', 'The Frostwatch Citadel', 'The Eagle’s Stair', 'The Glacial Bowl', 'The Mountaineers’ Lodge', 'The Far Summit'],
  'sacred-groves': ['The Silverroot Arcade', 'The Ancient Canopy', 'The Moonwell Clearing', 'The Mirrorleaf Lake', 'The Mosslight Hamlet', 'The Oldwood Watch'],
  'prismatic-waterfalls': ['The Rainstone Approach', 'The Rainbow Crown', 'The Singing Spillway', 'The Seven-Colour Pools', 'The Mistwalk Hamlet', 'The Farwater Outlook'],
  'cosmic-deserts': ['The Meridian Caravanserai', 'The Sunken Astrolabe', 'The Duneglass Causeway', 'The Starlit Oasis', 'The Nomads’ Exchange', 'The Far Sandwatch'],
  'city-of-stars': ['The Constellation Avenue', 'The Astral Crown', 'The Meteor Exchange', 'The Celestial Basin', 'The Stargazers’ Borough', 'The Three-Realm Horizon'],
  'sacred-temples': ['The Pilgrims’ Colonnade', 'The Ancestor Sanctum', 'The Bellstone Court', 'The Sacred Lotus Basin', 'The Carvers’ Quarter', 'The Sentinel Gate'],
  'ancient-pyramids': ['The Pharaoh’s Causeway', 'The Crown Pyramid', 'The Sun-Dial Necropolis', 'The Buried Oasis', 'The Excavators’ Camp', 'The Western Sphinx'],
  'sanctified-cathedrals': ['The Lantern Procession', 'The High Bell Tower', 'The Rose-Window Cloister', 'The Saintwater Basin', 'The Masons’ Quarter', 'The Votive Outlook'],
  'zen-gardens': ['The Bamboo Procession', 'The Quiet Pagoda', 'The Raked-Stone Garden', 'The Stillwater Pavilion', 'The Tea-Keepers’ Court', 'The Evening Gate'],
  'sacred-monuments': ['The Processional Stones', 'The Memorial Crown', 'The Pillars of Memory', 'The Reflecting Cairn', 'The Chroniclers’ Court', 'The Timeless Watch'],
  'living-settlements': ['The Merchant Avenue', 'The Bellwatch Keep', 'The Riverside Granary', 'The Millpond Gardens', 'The Craftsmen’s Borough', 'The Shepherds’ Watch'],
  'forests-plains-and-lakes': ['The Wildflower Trail', 'The Pinewatch Tower', 'The Great Meadow', 'The Willowmere Lake', 'The Lakeside Hamlet', 'The Farwood Lookout'],
  'infernal-abyss': ['The Ashen Causeway', 'The Abyssal Crown', 'The Riftward Bastion', 'The Blackwater Crucible', 'The Refuge of Embers', 'The Last Watchfire'],
  'malevolent-citadels': ['The Iron Procession', 'The Tyrant’s Observatory', 'The Obsidian Barracks', 'The Cinder Crucible', 'The Armourers’ Quarter', 'The Black Rampart'],
  'realm-of-eternal-conflict': ['The Truce Causeway', 'The Siegeclock Tower', 'The Shattered Arena', 'The Ashwater Basin', 'The Quartermasters’ Camp', 'The Last Redoubt'],
  'pits-of-suffering': ['The Chainstone Walk', 'The Iron Belfry', 'The Furnace Court', 'The Cinder Wells', 'The Recovery Encampment', 'The Silent Watch'],
  'forsaken-wastelands': ['The Saltwind Road', 'The Broken Crown', 'The Ashglass Expanse', 'The Lostwater Basin', 'The Salvagers’ Camp', 'The Distant Signal'],
  'chaos-chasms': ['The Riftstone Approach', 'The Fractured Orrery', 'The Resonant Causeway', 'The Shifting Crucible', 'The Anchorkeepers’ Court', 'The Edgewatch Tower'],
  'malevolence-forest': ['The Thornroot Arcade', 'The Hollow Canopy', 'The Witchlight Clearing', 'The Blackthorn Mere', 'The Lantern Refuge', 'The Oldroot Watch'],
  'pits-of-despair': ['The Lantern Descent', 'The Hollow Bell Tower', 'The Echoing Court', 'The Still Cinder Pools', 'The Keepers’ Refuge', 'The Last-Light Outlook'],
  'infernal-strongholds': ['The Ironbound Avenue', 'The Dreadnought Keep', 'The Forgeward Bastion', 'The Warfire Crucible', 'The Armourers’ Borough', 'The Outer Redoubt'],
  'infernal-gates': ['The Ember Procession', 'The Gatewright Spire', 'The Three-Seal Crossing', 'The Returning Crucible', 'The Waykeepers’ Court', 'The Far Threshold'],
  'dark-spire-towers': ['The Obsidian Approach', 'The Crown of Spires', 'The Nightglass Arcade', 'The Shadow-Well Basin', 'The Stonewright Court', 'The Eclipse Watch'],
  'tormented-ruins': ['The Broken Procession', 'The Fallen Crown', 'The Buried Amphitheatre', 'The Ashen Reflection', 'The Recovery Borough', 'The Ruinwatch Tower'],
  'suffering-labyrinths': ['The Threadkeeper Road', 'The Labyrinth Crown', 'The Turning Court', 'The Memory Crucible', 'The Cartographers’ Refuge', 'The Unbroken Exit'],
};

const P = (x, y) => ({ x, y });
const road = (id, values, width, style) => ({ id, points: values.map(([x,y]) => P(x,y)), width, style, expansion: true });
const room = (id, name, x, y, width, height, theme, floor) => ({ id, name, x, y, width, height, theme, floor, doorSide: 'south', public: true, roofFade: true, expansion: true });
const polygon = (id, values, kind) => ({ id, points: values.map(([x,y]) => P(x,y)), kind });

function archetype(zone, theme) {
  if (/libraries|knowledge/.test(zone.id)) return { type: 'observatory', room: 'library', focus: 'archive', detail: 'tiered reading galleries and illuminated record pillars', assets: ['ruin-heaven','crystal','tree-heaven'] };
  if (/observator|stars/.test(zone.id)) return { type: 'observatory', room: 'temple', focus: 'astral', detail: 'orbital instruments, lens towers and a visible meridian court', assets: ['floating-island','ruin-heaven','crystal'] };
  if (/pyramid|desert/.test(zone.id)) return { type: 'obelisk', room: 'pyramid', focus: 'desert', detail: 'stepped sandstone chambers, caravan shelters and a sunken oasis', assets: ['palm','ruin-desert','cactus'] };
  if (/mountain/.test(zone.id)) return { type: 'tower', room: 'tower', focus: 'mountain', detail: 'granite watchtowers, sheltered switchbacks and glacial terraces', assets: ['crag','tree-snow','rock-0'] };
  if (/gardens|groves|forest|fields/.test(zone.id)) return { type: 'garden', room: 'temple', focus: 'garden', detail: 'sheltered groves, terraced gardens and ancient stone pavilions', assets: theme === 'hell' ? ['tree-corrupt','dead-tree','crystal-void'] : ['tree-oak-gold','tree-oak','flowers-blue'] };
  if (/waterfall|bridges/.test(zone.id)) return { type: 'bridge', room: 'temple', focus: 'water', detail: 'raised spillways, bridge arcades and reflecting-water terraces', assets: ['cliff','tree-pine-blue','ruin-heaven'] };
  if (zone.realm === 'hell') return { type: /citadel|stronghold|conflict/.test(zone.id) ? 'forge' : 'tower', room: /labyrinth/.test(zone.id) ? 'labyrinth' : 'citadel', focus: 'infernal', detail: 'obsidian bastions, ember-lit foundries and protected ash-road courts', assets: ['obsidian-spire','ruin-infernal','brazier'] };
  if (/cities|settlements|palace|halls|cathedrals/.test(zone.id)) return { type: 'tower', room: 'palace', focus: 'civic', detail: 'broad colonnades, occupied market streets and vaulted public halls', assets: zone.realm === 'heaven' ? ['temple-heaven','ruin-heaven','tree-heaven'] : ['ruin','tree-oak-gold','fountain'] };
  return { type: 'arch', room: 'temple', focus: 'sanctuary', detail: 'pilgrim arcades, wayfinding towers and open-air sanctuary courts', assets: ['temple-forest','tree-oak','ruin'] };
}

export function createRegionExpansion(zone, theme, index = 0) {
  const names = DISTRICTS[zone.id];
  if (!names) throw new Error(`Missing frontier districts for ${zone.id}`);
  const profile = archetype(zone, theme), infernal = zone.realm === 'hell';
  const style = theme === 'desert' ? 'sand' : infernal ? 'ash' : zone.realm === 'heaven' || theme === 'city' ? 'marble' : 'stone';
  const accent = infernal ? '#fb8c83' : zone.realm === 'heaven' ? '#bdc5ff' : theme === 'desert' ? '#edc797' : '#74ddce';
  const centers = [[2900,900],[4100,650],[4100,2100],[2800,2800],[1500,2800],[470,3050]];
  const kinds = ['gateway','citadel','wilds','waterside','settlement','lookout'];
  const districts = centers.map(([x,y],i) => ({ id: `${zone.id}:district:${i}`, name: names[i], x, y, radius: i===2 ? 390 : 330, kind: kinds[i], theme: profile.focus, description: `${names[i]} opens into ${profile.detail}. Follow the marked roads back to the region's sanctuary.`, accent }));
  const roads = [
    road('frontier:east-approach',[[920,900],[2240,920],[2540,920],[2900,900]],112,style),
    road('frontier:south-approach',[[920,900],[920,1620],[920,2220],[1500,2800]],108,style),
    road('frontier:grand-circuit',[[2900,900],[4100,650],[4380,1240],[4100,2100],[2800,2800],[1500,2800],[470,3050],[470,2200],[920,1620]],116,style),
    road('frontier:crossing',[[2900,900],[2760,1850],[2800,2800]],104,style),
    road('frontier:lakeside',[[2760,1850],[3500,1900],[4100,2100]],98,style),
    road('frontier:lower-arcade',[[1500,2800],[1500,3220],[2800,3220],[2800,2800]],88,style),
    road('frontier:high-gallery',[[2900,900],[2900,450],[3650,450],[4100,650]],84,style),
    road('frontier:west-garden',[[470,2200],[300,2490],[470,3050],[930,3220],[1500,3220]],86,style),
  ];
  // Side chambers are placed beside, rather than across, the principal public roads.
  const interiors = [
    room(`${zone.id}:frontier-hall`, names[0], 2650, 320, 650, 430, profile.room, infernal ? 'obsidian' : theme === 'desert' ? 'sandstone' : 'marble'),
    room(`${zone.id}:frontier-crown`, names[1], 3820, 150, 580, 360, profile.room, infernal ? 'obsidian' : theme === 'desert' ? 'sandstone' : 'marble'),
    room(`${zone.id}:frontier-lodge`, names[4], 1160, 2360, 650, 300, profile.room === 'library' ? 'library' : 'temple', infernal ? 'obsidian' : theme === 'desert' ? 'sandstone' : 'marble'),
  ];
  for (const [i,r] of interiors.entries()) roads.push(road(`frontier:door:${i}`,[[r.x+r.width/2,r.y+r.height-30],[r.x+r.width/2,r.y+r.height+160],centers[i===2?4:i]],84,style));
  const water = [polygon(`${zone.id}:frontier-basin`,[[3050,1450],[3540,1500],[3800,1770],[3690,2250],[3170,2300],[2920,2050],[2950,1670]],infernal ? 'lava' : /observator|stars|chasm|abyss/.test(zone.id) ? 'void' : 'water')];
  const landmarks = districts.map((d,i) => ({ id: `frontier-${i}`, name: d.name, x:d.x, y:d.y, description:d.description, frontier:true, districtId:d.id, discoveryRadius:220, asset:profile.assets[i%profile.assets.length], scale:i===1?1.7:1.15, radius:0 }));
  const architecturalFeatures = districts.flatMap((d,i) => [
    { id:`${d.id}:monument`, x:d.x+155, y:d.y-120, width:i===1?240:150, height:i===1?330:190, type:i===2?'arch':i===3?'bridge':i===4?'forge':i===5?'tower':profile.type, theme:profile.focus, accent, rotation: (index+i)%4*Math.PI/2 },
    { id:`${d.id}:gate`, x:d.x-155, y:d.y+75, width:120,height:150,type:i===3?'obelisk':'arch',theme:profile.focus,accent },
  ]);
  const habitats = [districts[2],districts[3],districts[5]].map((d,i) => ({ id:`${zone.id}:habitat:${i}`, x:d.x+(i===0?70:0), y:d.y+(i===0?130:-150), radius:210, rank:Math.min(10,(zone.minRank||1)+i), realm:zone.realm, biome:profile.focus, renewable:true,respawnSeconds:120 }));
  const resourceAnchors = districts.flatMap((d,i) => Array.from({length:16},(_,j) => {const angle=j/16*Math.PI*2, radius=130+(j%3)*28;return {id:`frontier-resource:${zone.id}:${i*16+j}`,x:d.x+Math.cos(angle)*radius,y:d.y+Math.sin(angle)*radius,item:['herb','crystal','wood','stone'][(i+j+index)%4],districtId:d.id};}));
  return { ...REGION_SIZE, districts, roads, interiors, water, landmarks, architecturalFeatures, habitats, resourceAnchors, scenicAssets:profile.assets, accent, detail:profile.detail };
}

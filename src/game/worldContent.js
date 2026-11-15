import { ZONES } from '../data/manual.js';
import { createRegionExpansion } from './worldExpansion.js';
import { createRegionalEncounters } from './encounters.js';

// These layouts are authored separately. Seeded scenery fills their margins; it never
// chooses the roads, rooms, crossings, landmarks, or campaign acceptance conditions.
const point = (x, y) => ({ x, y });
const points = values => values.map(([x, y]) => point(x, y));
const rect = (x, y, width, height, extra = {}) => ({ x, y, width, height, ...extra });
const lake = (id, values, kind = 'water') => ({ id, points: points(values), kind });
const route = (id, values, width = 84, style = 'stone') => ({ id, points: points(values), width, style });
const landmark = (id, name, x, y, detail = '') => ({ id, name, x, y, description: detail });
const hall = (id, name, x, y, width, height, theme, doorSide = 'south') => ({ id, name, x, y, width, height, theme, floor: ['citadel','tower','labyrinth'].includes(theme) ? 'obsidian' : theme === 'pyramid' ? 'sandstone' : 'marble', doorSide, public: !['palace','citadel'].includes(theme), roofFade: true });
const L = (theme, roads, landmarks, extra = {}) => ({ theme, roads, landmarks, water: [], walls: [], cliffs: [], interiors: [], ...extra });

export const AUTHORED_LAYOUTS = {
 'ethereal-sanctuary': L('heaven',[
  route('terrace-circuit',[[240,1260],[460,1040],[680,1080],[920,900],[1220,900],[1510,1120],[2050,1120]],108,'marble'),
  route('training-terraces',[[460,1040],[460,450],[900,450],[1260,570],[1590,370],[2020,480]],92,'marble'),
  route('quiet-terrace',[[920,900],[920,1440],[1510,1440],[1510,1120]],82,'marble')
 ],[landmark('arrival-terrace','The Arrival Terrace',460,450,'A public refuge with clearly marked arrival pads.'),landmark('mirror-court','Mirror Practice Court',1590,370,'Renewable targets support exact cancellation practice.'),landmark('quiet-garden','The Quiet Terrace',1510,1440,'Sheltered gardens offer ordinary rest without compulsory combat.')],{water:[lake('reflection-basin',[[650,240],[1100,240],[1100,330],[650,330]]),lake('quiet-pool',[[1740,1270],[2130,1270],[2130,1500],[1740,1500]])]}),
 'divine-cities': L('city',[
  route('civic-avenue',[[180,900],[920,900],[1550,900],[2150,900]],120,'marble'),route('market-loop',[[450,900],[450,390],[1080,390],[1080,1220],[2030,1220],[2030,420],[1550,420],[1550,900]],94,'marble'),route('upper-lane',[[1080,390],[1560,260],[2030,420]],78,'marble')
 ],[landmark('market-square','The Public Exchange',450,390,'Posted commissions distinguish personal and project storage.'),landmark('permit-court','Civic Permit Court',1550,420,'A permit is acquired through evidence, not an influence spell.'),landmark('repair-yard','The Repair Yard',2030,1220,'Finite construction lots restore civic services.'),landmark('upper-terrace','The Upper Terrace',1560,260,'A separate public landing pad avoids market congestion.')],{water:[lake('civic-canal',[[1750,0],[1840,0],[1840,1600],[1750,1600]])],interiors:[hall('civic-hall','Civic Hall',1280,180,600,330,'palace')]}),
 'halls-of-knowledge': L('city',[
  route('reading-approach',[[240,1120],[650,1120],[920,900],[1260,900],[1700,900],[1700,340]],92,'marble'),route('reading-courts',[[650,1120],[650,430],[1030,430],[1030,900]],82,'marble'),route('index-loop',[[1260,900],[1260,1380],[2120,1380],[2120,740],[1700,740]],74,'marble')
 ],[landmark('index-terminal','The Indexed Terminal',1700,340,'Evidence identifiers are recorded before any answer is accepted.'),landmark('reading-court','The Reading Court',650,430,'A public courtyard separates research from restricted shelves.'),landmark('proof-desk','The Proof Desk',2120,1380,'A verified evidence chain resolves the commission.')],{interiors:[hall('knowledge-hall','The Long Reading Hall',1350,200,780,690,'library'),hall('proof-room','Proof Room',1900,1120,360,400,'library')],walls:[rect(1450,350,360,28),rect(1450,500,500,28),rect(1450,650,360,28)]}),
 'ethereal-libraries': L('city',[
  route('archive-spine',[[260,900],[920,900],[1430,900],[1430,400],[2020,400]],92,'marble'),route('west-stacks',[[480,900],[480,310],[1080,310],[1080,600],[1430,600]],78,'marble'),route('south-index',[[920,900],[920,1370],[1500,1370],[2050,1120],[2050,700],[1430,700]],82,'marble')
 ],[landmark('evidence-vault','The Open Evidence Vault',480,310,'The vault holds inspected records rather than hidden puzzle answers.'),landmark('catalogue-gallery','Catalogue Gallery',2020,400,'Catalogue terminals identify exact evidence objects.'),landmark('respite-room','The Respite Room',1500,1370,'Recovery access remains available while a research task is active.'),landmark('return-desk','The Return Desk',2050,1120,'Borrowed quest records are returned without changing ownership.')],{interiors:[hall('north-archive','North Archive',290,180,1000,420,'library'),hall('east-archive','East Archive',1620,180,650,650,'library')],walls:[rect(580,240,24,220),rect(760,240,24,220),rect(940,240,24,220),rect(1760,250,24,300),rect(1910,250,24,300)]}),
 'ethereal-gardens': L('garden',[
  route('garden-stair',[[250,1450],[500,1230],[500,940],[920,900],[1310,900],[1310,590],[1750,590],[1750,300]],84,'marble'),route('irrigation-loop',[[500,940],[500,380],[950,380],[950,590],[1310,590],[1310,1280],[2000,1280],[2000,800],[1750,800]],74,'marble')
 ],[landmark('upper-beds','The Upper Beds',1750,300,'Each ecological bed has a finite harvest identity.'),landmark('irrigation-wheel','The Irrigation Wheel',500,380,'Reconnecting irrigation repairs a distinct route condition.'),landmark('mature-orchard','The Mature Orchard',2000,1280,'Only authorized mature crop lots may be gathered.')],{water:[lake('north-irrigation',[[250,620],[1160,620],[1160,680],[250,680]]),lake('east-irrigation',[[1520,760],[1590,760],[1590,1500],[1520,1500]]),lake('lower-pool',[[1710,1420],[2190,1420],[2190,1620],[1710,1620]])]}),
 'celestial-waterfalls': L('water',[
  route('spray-approach',[[250,1200],[650,1200],[920,900],[1400,900],[1780,900],[2110,900]],96,'marble'),route('sheltered-switchback',[[650,1200],[650,550],[1130,550],[1130,280],[1520,280],[1780,500],[2110,500],[2110,900]],84,'marble'),route('lower-ledge',[[1400,900],[1400,1390],[2010,1390],[2110,900]],78,'marble')
 ],[landmark('crown-pool','The Crown Pool',1520,280,'Stepped pools feed the public crossing.'),landmark('sheltered-ledge','The Sheltered Ledge',650,550,'An alternate ground path remains outside the surge.'),landmark('surge-sigil','The Surge Sigil',2010,1390,'The source warns before a bounded water-pressure surge.')],{water:[lake('crown-flow',[[1680,0],[1870,0],[1870,640],[1790,940],[1870,1800],[1690,1800],[1610,940],[1680,640]])],cliffs:[rect(1150,390,530,80),rect(1870,390,350,80),rect(1120,1110,490,90),rect(1880,1110,360,90)]}),
 'palatial-halls': L('heaven',[
  route('audience-axis',[[240,900],[920,900],[1420,900],[1900,900],[1900,340]],112,'marble'),route('balcony-approach',[[600,900],[600,350],[1220,350],[1420,600],[1900,600]],78,'marble'),route('service-court',[[1420,900],[1420,1400],[2110,1400],[2110,900]],84,'marble')
 ],[landmark('audience-court','The Audience Court',1900,340,'Posted decision policies govern diplomatic proposals.'),landmark('visitor-balcony','The Visitor Balcony',600,350,'A public balcony gives an alternate route without trespass.'),landmark('service-court','The Service Court',2110,1400,'Owners and visitors retain separate permissions.')],{interiors:[hall('audience-hall','The Audience Hall',1510,160,700,620,'palace'),hall('guest-hall','Guest Hall',380,180,680,340,'palace')],water:[lake('court-reflection',[[1600,1120],[1980,1120],[1980,1230],[1600,1230]])]}),
 'celestial-palaces': L('heaven',[
  route('royal-court',[[220,1250],[580,1250],[920,900],[1370,900],[1370,500],[1990,500],[2190,900]],112,'marble'),route('west-gallery',[[580,1250],[580,460],[930,250],[1370,500]],84,'marble'),route('east-gallery',[[1370,900],[1700,1180],[2190,1180],[2190,900]],88,'marble')
 ],[landmark('open-audience','The Open Audience',1990,500,'A complete project proposal is reviewed here.'),landmark('three-wings','The Three Wings',930,250,'Three independently owned wings share a public corridor.'),landmark('rose-court','The Rose Court',580,1250,'A garden offers a negotiated alternative to restricted passage.'),landmark('landing-gallery','The Landing Gallery',2190,1180,'The arrival pad validates occupancy before travel.')],{interiors:[hall('west-wing','West Wing',280,240,540,600,'palace'),hall('north-wing','North Wing',1180,160,690,360,'palace'),hall('east-wing','East Wing',1890,300,380,710,'palace')],walls:[rect(1460,1120,240,20)]}),
 'astral-observatory': L('heaven',[
  route('instrument-triangle',[[920,900],[470,420],[1760,340],[2070,1390],[920,900]],94,'marble'),route('southern-sightline',[[470,420],[380,1320],[920,900],[2070,1390]],76,'marble')
 ],[landmark('dawn-lens','The Dawn Lens',470,420,'The instrument shows its next visible alignment window.'),landmark('meridian-dial','The Meridian Dial',1760,340,'A marked dial can be stabilized through a valid local action.'),landmark('horizon-platform','The Horizon Platform',2070,1390,'The ground route ends at a discovered landing anchor.')],{water:[lake('observatory-gap',[[1220,200],[1450,200],[1450,660],[1220,660]],'void'),lake('southern-gap',[[1210,1250],[1510,1150],[1770,1630],[1380,1670]],'void')],cliffs:[rect(1880,590,300,80)]}),
 'celestial-observatories': L('heaven',[
  route('four-instruments',[[400,400],[920,900],[1960,380],[1960,1400],[920,900],[430,1410],[400,400]],92,'marble'),route('meridian',[[430,1410],[1330,1410],[1330,540],[1960,380]],80,'marble')
 ],[landmark('western-array','The Western Array',400,400,'The first instrument provides evidence for the alignment.'),landmark('eastern-array','The Eastern Array',1960,380,'Its state can be compared without guessing at hidden lore.'),landmark('southern-array','The Southern Array',1960,1400,'Three observations establish a verifiable world-model plan.'),landmark('accord-platform','The Accord Platform',430,1410,'The Heaven accord is settled through coordinated instrument access.')],{water:[lake('mirror-channel',[[1490,650],[1580,650],[1580,1300],[1490,1300]],'void')],interiors:[hall('instrument-chamber','Instrument Chamber',1680,180,550,400,'temple')]}),
 'eternal-light-fields': L('heaven',[
  route('lightway',[[180,900],[920,900],[1770,900],[2200,1350]],112,'marble'),route('shelter-circuit',[[420,340],[920,900],[480,1440],[1770,1440],[1770,340],[420,340]],86,'marble')
 ],[landmark('dawn-shelter','The Dawn Shelter',420,340,'Rest-site access is independent from decorative brightness.'),landmark('pressure-boundary','The Pressure Boundary',1770,340,'Only the marked pressure field applies Exposed.'),landmark('respite-ring','The Respite Ring',1770,1440,'A recovery gathering creates a bounded public respite.')],{hazardFields:[{id:'light-pressure',x:2040,y:1000,radius:110,tag:'light',warning:2}],water:[]}),
 'iridescent-temples': L('heaven',[
  route('temple-approach',[[250,1150],[650,1150],[920,900],[1440,900],[1900,900]],98,'marble'),route('courtyard-circuit',[[650,1150],[650,430],[1260,430],[1260,1350],[2050,1350],[2050,430],[1260,430]],84,'marble')
 ],[landmark('purity-court','The Purity Court',650,430,'A local cleansing trial identifies a specific imposed status.'),landmark('respite-sanctum','The Respite Sanctum',1900,900,'Blessings declare cost, duration, and stacking category.'),landmark('prism-trial','The Prism Trial',2050,1350,'The trial uses a resettable visible condition.')],{interiors:[hall('outer-temple','Outer Temple',1460,340,760,930,'temple')],walls:[rect(1530,650,230,24),rect(1880,1080,240,24)]}),
 'translucent-bridges': L('heaven',[
  route('upper-span',[[320,470],[930,470],[1420,470],[2110,470]],90,'marble'),route('middle-span',[[230,900],[920,900],[1420,900],[2170,900]],110,'marble'),route('lower-span',[[340,1390],[920,1390],[1420,1390],[2110,1390]],90,'marble'),route('anchor-stairs',[[930,470],[920,900],[920,1390]],82,'marble'),route('far-anchors',[[2110,470],[2170,900],[2110,1390]],82,'marble')
 ],[landmark('upper-anchor','The Upper Span Anchor',2110,470,'A pulsing segment warns before its local crossing interval ends.'),landmark('public-span','The Public Span',1420,900,'The ground route preserves safe departure.'),landmark('cargo-anchor','The Cargo Anchor',2110,1390,'Cargo access and consenting passengers are checked separately.')],{water:[lake('translucent-chasm',[[1190,0],[1660,0],[1660,1800],[1190,1800]],'void')]}),
 'celestial-sanctuaries': L('forest',[
  route('home-lane',[[210,900],[920,900],[1450,900],[2170,900]],112),route('plot-lane',[[430,900],[430,400],[980,400],[1450,600],[1990,380]],86),route('garden-lane',[[430,900],[430,1370],[1430,1370],[1990,1210],[2170,900]],86)
 ],[landmark('public-storage','The Public Recovery Store',430,400,'Separate withdrawal rights protect stored goods.'),landmark('construction-green','The Construction Green',1990,380,'Placement validates arrival lanes and component ownership.'),landmark('garden-plots','The Garden Plots',1430,1370,'Decorative growth does not create additional harvest lots.')],{hamlet:[{x:380,y:640},{x:710,y:410},{x:1620,y:600},{x:2040,y:1260}],water:[lake('sanctuary-pond',[[1620,1360],[2040,1360],[2140,1580],[1640,1600]])]}),
 'majestic-mountain-ranges': L('mountain',[
  route('sheltered-pass',[[210,1280],[520,1280],[520,900],[920,900],[1260,900],[1260,560],[1900,560],[2190,820]],100),route('high-pass',[[520,900],[520,370],[1100,370],[1100,560],[1900,560]],84),route('valley-route',[[1260,900],[1260,1390],[2050,1390],[2190,820]],88)
 ],[landmark('west-pass','The Sheltered Pass',520,370,'The ground pass remains available when gusts close a flight lane.'),landmark('ridge-anchor','The Ridge Anchor',1900,560,'A stable high viewpoint reveals visible landmarks.'),landmark('valley-refuge','The Valley Refuge',2050,1390,'Escort cargo can shelter from weather pressure here.')],{cliffs:[rect(160,600,550,100),rect(900,1140,650,95),rect(1510,300,670,100),rect(1790,1000,440,90)],water:[lake('meltwater',[[1520,100],[1610,100],[1610,1450],[1520,1450]])]}),
 'sacred-groves': L('forest',[
  route('grove-path',[[160,920],[920,900],[1382,930],[2240,920]],108),route('grove-spine',[[920,160],[920,900],[920,1620]],82)
 ],[landmark('sacred-shrine','The Sanctuary Shrine',915,736,'The first protected ritual and recovery anchor.'),landmark('old-ruins','The Old Ruins',2040,580,'Visible habitat anchors offer a peaceful guardian route.'),landmark('moonleaf-clearing','The Moonleaf Clearing',650,835,'A finite gatherable lot supports a first restoration task.'),landmark('pilgrim-cache','The Pilgrim’s Rest',1930,1330,'The marked recovery cache belongs to this encounter identity.')],{legacy:true,water:[lake('grove-stream',[[1340,0],[1490,0],[1490,1800],[1340,1800]])]}),
 'prismatic-waterfalls': L('water',[
  route('prismatic-rim',[[230,1210],[530,1210],[920,900],[1280,900],[1670,760],[2150,760]],96),route('spray-switchback',[[530,1210],[530,390],[1030,390],[1280,610],[1670,760],[1970,340]],84),route('lower-bank',[[1280,900],[1280,1390],[2040,1390],[2150,760]],84)
 ],[landmark('rainbow-ledges','The Prismatic Ledges',1970,340,'An authorized object can be recovered from the ledge.'),landmark('flow-valve','The Flow Valve',1030,390,'The actual flow source is separate from decorative spray.'),landmark('bank-crossing','The Lower Bank Crossing',2040,1390,'The public crossing is stabilized after a readable surge.')],{water:[lake('prismatic-cut',[[1390,0],[1530,0],[1530,560],[1840,1130],[1840,1800],[1690,1800],[1690,1150],[1390,630]])],cliffs:[rect(1570,270,550,90),rect(1450,1120,240,95)]}),
 'cosmic-deserts': L('desert',[
  route('caravan-line',[[210,900],[920,900],[1370,900],[1370,440],[2060,440]],110,'sand'),route('oasis-detour',[[460,900],[460,1350],[1120,1350],[1770,1430],[2060,1000],[2060,440]],92,'sand'),route('stone-corridor',[[460,900],[460,350],[1030,350],[1370,440]],84,'sand')
 ],[landmark('stone-compass','The Stone Compass',1030,350,'Visible alignment identifies the safe caravan corridor.'),landmark('oasis-project','The Oasis Project Site',1770,1430,'An oasis remains a finite regional restoration project.'),landmark('refuge-stones','The Refuge Stones',460,1350,'A sheltered ground stop preserves a safe return.'),landmark('sunken-gate','The Sunken Gate',2060,440,'The gate opens through its mechanism, not a guessed phrase.')],{water:[lake('oasis-water',[[1510,1470],[1890,1470],[1940,1650],[1450,1630]])],cliffs:[rect(650,480,130,280),rect(1650,600,110,450),rect(1090,1450,330,90)]}),
 'city-of-stars': L('city',[
  route('star-west',[[260,1040],[920,900],[1530,560],[2040,300]],104,'marble'),route('star-east',[[920,900],[1630,900],[2210,1100]],104,'marble'),route('star-south',[[920,900],[1380,1390],[1880,1580]],100,'marble'),route('star-north',[[920,900],[710,390],[1100,190]],96,'marble'),route('outer-market',[[710,390],[1530,560],[2210,1100],[1380,1390],[470,1420],[260,1040],[710,390]],88,'marble')
 ],[landmark('alignment-market','The Alignment Market',1530,560,'Trading quotes expire cleanly when the alignment window closes.'),landmark('concordance-dais','The Concordance Dais',1880,1580,'The three realm accords meet at a reversible world-mastery project.'),landmark('departure-beacon','The Departure Beacon',2040,300,'Public departure remains available throughout the alignment.'),landmark('star-clock','The Star Clock',1100,190,'An observed clock displays the current access window.')],{interiors:[hall('star-exchange','Star Exchange',1730,610,530,500,'palace')],water:[lake('star-mirror',[[330,250],[600,250],[600,550],[330,550]])]}),
 'sacred-temples': L('forest',[
  route('temple-road',[[210,1140],[620,1140],[920,900],[1430,900],[1990,900]],100),route('evidence-court',[[620,1140],[620,410],[1280,410],[1430,610],[1990,610],[1990,900]],82),route('witness-lane',[[1430,900],[1430,1390],[2050,1390],[1990,900]],82)
 ],[landmark('witness-court','The Witness Court',620,410,'Witness evidence survives a magical cleansing.'),landmark('condition-sanctum','The Condition Sanctum',1990,610,'The removable field is identified before any cleanse.'),landmark('allocation-room','The Allocation Room',2050,1390,'The parties decide how a finite resource lot is shared.')],{interiors:[hall('east-temple','East Temple',1510,320,700,890,'temple')],walls:[rect(1610,680,240,22),rect(1900,1090,240,22)]}),
 'ancient-pyramids': L('desert',[
  route('pyramid-ramp',[[210,1110],[580,1110],[920,900],[1360,900],[1360,570],[1800,570],[2070,920]],100,'sand'),route('southern-ramp',[[580,1110],[580,1450],[1580,1450],[2070,920]],86,'sand'),route('chamber-spine',[[1360,570],[1360,280],[2070,280],[2070,920]],80,'sand')
 ],[landmark('entry-mechanism','The Entry Mechanism',1360,280,'A visible three-state mechanism controls the passage.'),landmark('artifact-chamber','The Authorized Artifact Chamber',2070,280,'The artifact remains quest-bound until delivery.'),landmark('lower-ramp','The Lower Ramp',1580,1450,'A safer route remains available around the moving floor.')],{interiors:[hall('pyramid-chambers','The Layered Chambers',1210,150,1000,1050,'pyramid')],walls:[rect(1490,380,450,32),rect(1490,720,350,32),rect(1860,930,240,32)],cliffs:[rect(650,430,390,95)]}),
 'sanctified-cathedrals': L('city',[
  route('processional-aisle',[[210,900],[920,900],[1420,900],[2100,900]],118),route('north-gallery',[[1420,900],[1420,350],[2100,350],[2100,900]],84),route('south-gallery',[[1420,900],[1420,1450],[2100,1450],[2100,900]],84),route('service-walk',[[510,900],[510,430],[1030,430],[1030,1350],[510,1350],[510,900]],78)
 ],[landmark('public-nave','The Public Nave',2100,900,'A protected recovery gathering meets here.'),landmark('north-gallery','The North Gallery',2100,350,'A readable straight-line encounter can be avoided through cover.'),landmark('south-service','The South Service Court',2100,1450,'Escort arrivals preserve their recorded identity.'),landmark('witness-vestry','The Witness Vestry',510,430,'The evidence chain is based on observed object states.')],{interiors:[hall('cathedral-nave','The Cathedral Nave',1270,190,1000,1400,'temple')],walls:[rect(1550,500,30,220),rect(1810,500,30,220),rect(1550,1090,30,220),rect(1810,1090,30,220)]}),
 'zen-gardens': L('garden',[
  route('quiet-circuit',[[350,1200],[350,500],[920,500],[920,900],[1450,900],[1450,500],[2010,500],[2010,1300],[920,1300],[350,1200]],76),route('stepping-line',[[920,900],[1740,900],[2010,1300]],64)
 ],[landmark('raked-court','The Raked Court',350,500,'Protected decorative stones are distinct from movable objects.'),landmark('stepping-pond','The Stepping Pond',1740,900,'Aligned stepping stones leave a clear route through shallow water.'),landmark('offering-garden','The Offering Garden',2010,1300,'A finite decorative gift meets the posted NPC need.')],{water:[lake('zen-pond',[[1560,650],[1880,650],[2020,900],[1890,1130],[1560,1130],[1460,900]])],walls:[rect(600,320,330,22),rect(2050,640,22,400)]}),
 'sacred-monuments': L('forest',[
  route('monument-avenue',[[160,900],[920,900],[1500,900],[2100,900]],126),route('gathering-ring',[[1500,900],[1500,350],[2110,350],[2200,900],[2110,1430],[1500,1430],[1500,900]],96),route('evidence-walk',[[520,900],[520,350],[1130,350],[1500,350]],82)
 ],[landmark('central-monument','The Gathering Monument',2110,900,'Structural cracks and crowd morale are separate states.'),landmark('north-assembly','The North Assembly',2110,350,'A calm crowd can review the posted repair proposal.'),landmark('evidence-stones','The Evidence Stones',520,350,'Public evidence identifies the actual component to repair.')],{water:[lake('southern-reflection',[[1640,1500],[2140,1500],[2140,1630],[1640,1630]])],walls:[rect(1900,650,25,180),rect(1900,1000,25,180)]}),
 'living-settlements': L('city',[
  route('market-street',[[180,900],[920,900],[1460,900],[2200,900]],112),route('workshop-block',[[470,900],[470,380],[1150,380],[1150,1400],[1970,1400],[1970,380],[1150,380]],86),route('storehouse-lane',[[470,900],[470,1400],[1150,1400]],84)
 ],[landmark('craft-court','The Craft Court',470,380,'The public forge accepts explicit finite recipes.'),landmark('commons-store','The Commons Store',470,1400,'An allocation contract separates contribution from ownership.'),landmark('repair-bridge','The Service Bridge',1970,1400,'A repaired physical route reconnects the east market.'),landmark('civic-board','The Civic Board',1970,380,'Commissions post exact quantities, rewards, and failure terms.')],{water:[lake('settlement-channel',[[1540,0],[1650,0],[1650,1800],[1540,1800]])],hamlet:[{x:320,y:520},{x:750,y:380},{x:1260,y:1190},{x:2050,y:600},{x:650,y:1410}]}),
 'forests-plains-and-lakes': L('forest',[
  route('forest-margin',[[180,900],[920,900],[1260,900],[1260,430],[1880,430],[2180,900]],100),route('lakeshore-trail',[[450,900],[450,1380],[1260,1380],[2030,1510],[2180,900]],84),route('plains-route',[[450,900],[450,350],[1260,430]],82)
 ],[landmark('forest-hide','The Forest Hide',450,350,'Observation identifies a territorial creature without provoking it.'),landmark('plains-marker','The Plains Marker',1880,430,'Visible landmarks define the explored route.'),landmark('lake-outlet','The Lake Outlet',2030,1510,'Authorized harvests remain finite at the restored outlet.')],{water:[lake('great-lake',[[1530,610],[2010,580],[2260,880],[2110,1270],[1750,1390],[1450,1100]])]}),
 'infernal-abyss': L('hell',[
  route('shelf-line',[[200,900],[920,900],[1320,900],[1320,480],[1940,480],[2190,820]],100,'ash'),route('refuge-switchback',[[470,900],[470,1380],[1280,1380],[1940,1380],[2190,820]],86,'ash'),route('high-shelf',[[470,900],[470,400],[1060,400],[1320,480]],82,'ash')
 ],[landmark('stable-shelf','The Stable Shelf',470,400,'A recovery anchor separates safe terrain from the marked fissures.'),landmark('abyss-project','The Abyss Project Anchor',1940,480,'A pressure source can be inspected without entering it.'),landmark('lower-shelter','The Lower Shelter',1940,1380,'The ground detour preserves a retreat route.')],{water:[lake('abyss-cleft',[[1470,0],[1760,0],[1760,1000],[1610,1260],[1760,1800],[1480,1800],[1330,1260],[1470,1000]],'lava')],cliffs:[rect(1800,980,450,95)]}),
 'malevolent-citadels': L('hell',[
  route('citadel-road',[[170,900],[920,900],[1430,900],[2020,900]],118,'ash'),route('permit-route',[[500,900],[500,380],[1190,380],[1430,600],[2020,600]],82,'ash'),route('service-gate',[[1430,900],[1430,1420],[2130,1420],[2130,900]],88,'ash')
 ],[landmark('permit-gate','The Permit Gate',1430,600,'The same gate admits an evidence-backed permit or an authorized breach.'),landmark('citadel-exchange','The Citadel Exchange',2020,900,'Every merchant uses normal currency receipts.'),landmark('outer-court','The Outer Court',2130,1420,'The public service lane remains separate from restricted corridors.')],{interiors:[hall('citadel-interior','Citadel Interior',1530,220,700,1150,'citadel')],walls:[rect(1650,620,180,32),rect(1950,1120,180,32)],water:[lake('citadel-moat',[[1270,100],[1360,100],[1360,680],[1270,680]],'lava')]}),
 'realm-of-eternal-conflict': L('hell',[
  route('north-lane',[[250,400],[1090,400],[1730,400],[2190,610]],110,'ash'),route('middle-lane',[[180,900],[920,900],[1560,900],[2200,900]],122,'ash'),route('south-lane',[[250,1410],[1130,1410],[1730,1410],[2190,1190]],110,'ash'),route('refuge-link',[[680,400],[920,900],[680,1410]],92,'ash'),route('front-link',[[1730,400],[1730,900],[1730,1410]],80,'ash')
 ],[landmark('north-rally','The North Rally',1730,400,'Participating combatants and protected service areas are visibly distinct.'),landmark('neutral-table','The Neutral Table',680,1410,'A ceasefire proposal can settle the authored dispute.'),landmark('contested-ward','The Contested Ward',2200,900,'Only the identified defense project advances the objective.'),landmark('south-rally','The South Rally',1730,1410,'Independent lanes give support and flank routes.')],{walls:[rect(1390,520,250,50),rect(1850,1140,250,50),rect(1840,600,40,140),rect(1380,1080,40,160)]}),
 'pits-of-suffering': L('hell',[
  route('chamber-approach',[[210,1150],[600,1150],[920,900],[1360,900],[1360,430],[2000,430]],102,'ash'),route('recovery-ring',[[600,1150],[600,400],[1120,400],[1360,430],[2000,430],[2160,900],[2000,1420],[1360,1420],[1360,900]],84,'ash')
 ],[landmark('first-emitter','The First Emitter',2000,430,'The affliction source pulses before applying a removable condition.'),landmark('recovery-chamber','The Recovery Chamber',2000,1420,'An eligible injured identity can recover after its source is disabled.'),landmark('safe-threshold','The Safe Threshold',600,400,'The marked exit is never closed by an encounter.')],{interiors:[hall('pressure-chambers','Pressure Chambers',1490,180,740,1390,'citadel')],walls:[rect(1620,740,390,30),rect(1780,1010,390,30)]}),
 'forsaken-wastelands': L('hell',[
  route('ash-route',[[180,900],[920,900],[1230,900],[1560,560],[2090,560]],106,'ash'),route('shelter-chain',[[450,900],[450,1380],[1130,1380],[1710,1460],[2130,1070],[2090,560]],90,'ash'),route('upper-shelf',[[450,900],[450,360],[1080,360],[1560,560]],82,'ash')
 ],[landmark('ash-refuge','The Ash Refuge',450,1380,'A finite supply cache prepares the exposed route.'),landmark('depleted-site','The Depleted Site',1710,1460,'Habitat restoration starts only after the recovery project is identified.'),landmark('fissure-marker','The Fissure Marker',2090,560,'A visible tell precedes fissure expansion.')],{water:[lake('forked-lava',[[1220,0],[1350,0],[1350,510],[1700,890],[1880,1800],[1710,1800],[1560,970],[1220,570]],'lava')],cliffs:[rect(680,500,300,95),rect(1710,230,450,90)]}),
 'chaos-chasms': L('hell',[
  route('broken-zigzag',[[240,1300],[570,1300],[570,900],[920,900],[1260,900],[1260,450],[1770,450],[1770,1180],[2180,1180]],94,'ash'),route('stable-bypass',[[570,900],[570,300],[1260,300],[1770,450]],82,'ash'),route('south-anchor',[[1260,900],[1260,1510],[2180,1510],[2180,1180]],86,'ash')
 ],[landmark('timing-platform','The Timing Platform',1770,450,'Separated controls expose their current state to the party.'),landmark('stable-anchor','The Stable Anchor',570,300,'A distinct arrival pad validates the next landing.'),landmark('far-counterweight','The Far Counterweight',2180,1510,'A safe route reaches the second mechanism without compulsory flight.')],{water:[lake('west-chaos-cut',[[1050,0],[1170,0],[1170,1800],[1050,1800]],'void'),lake('east-chaos-cut',[[1910,0],[2080,0],[2080,1800],[1910,1800]],'void')]}),
 'malevolence-forest': L('hell',[
  route('hidden-trail',[[210,1220],[530,1220],[530,880],[920,900],[1270,1120],[1670,1120],[1670,600],[2120,600]],82,'ash'),route('observation-loop',[[530,880],[530,380],[1060,380],[1270,610],[1670,600],[2120,600],[2120,1400],[1670,1120]],76,'ash')
 ],[landmark('observation-hide','The Observation Hide',530,380,'A revealing outline identifies the real attacker before a strike.'),landmark('corrupt-roots','The Corrupt Roots',1670,1120,'The root source is separately tagged from imposed statuses.'),landmark('safe-trail','The Safe Trail Marker',2120,1400,'Route evidence permits a detour around concealed patrols.')],{water:[lake('shadow-pool',[[1380,200],[1740,200],[1810,390],[1430,450]],'water')],walls:[rect(1850,800,50,280)]}),
 'pits-of-despair': L('hell',[
  route('despair-ring',[[260,900],[920,900],[1340,900],[1340,430],[2080,430],[2080,1370],[1340,1370],[1340,900]],100,'ash'),route('shelter-route',[[520,900],[520,1380],[1000,1380],[1340,1370]],86,'ash'),route('north-return',[[520,900],[520,360],[1340,430]],80,'ash')
 ],[landmark('morale-source','The Morale Source',2080,430,'Disabling this emitter permits eligible NPC assistance.'),landmark('recovery-identity','The Recovery Identity',2080,1370,'Recovery eligibility is inspected before revival.'),landmark('resolve-shelter','The Resolve Shelter',520,1380,'NPC morale can be stabilized after the source is disabled.')],{water:[lake('north-pit',[[1480,550],[1770,550],[1870,780],[1700,940],[1430,800]],'void'),lake('south-pit',[[1550,1030],[1810,1030],[1890,1210],[1470,1240]],'void')]}),
 'infernal-strongholds': L('hell',[
  route('stronghold-entry',[[180,900],[920,900],[1370,900],[2050,900]],124,'ash'),route('north-service',[[530,900],[530,330],[1370,330],[2050,330],[2050,900]],92,'ash'),route('south-service',[[530,900],[530,1460],[1370,1460],[2050,1460],[2050,900]],92,'ash'),route('inner-front',[[1640,330],[1640,900],[1640,1460]],82,'ash')
 ],[landmark('defense-node','The Authorized Defense Node',2050,900,'The actual control node can be dismantled without attacking unrelated walls.'),landmark('north-service-gate','The North Service Gate',2050,330,'An alternate entrance remains available for a negotiated permit.'),landmark('quartermaster-court','The Quartermaster Court',530,1460,'Finite project materials support the route repair.'),landmark('southern-ward','The Southern Ward',2050,1460,'Coordinated defenders have readable support tells.')],{interiors:[hall('stronghold-compound','Stronghold Compound',1480,170,790,1450,'citadel')],walls:[rect(1750,600,260,35),rect(1830,1170,260,35)]}),
 'infernal-gates': L('hell',[
  route('gate-triangle',[[920,900],[510,370],[2010,370],[2080,1390],[920,900]],100,'ash'),route('departure-line',[[210,900],[920,900],[1560,900],[2200,900]],112,'ash'),route('south-return',[[510,370],[510,1390],[2080,1390]],84,'ash')
 ],[landmark('destination-panel','The Destination Panel',510,370,'The displayed destination is authoritative despite deceptive dialogue.'),landmark('arrival-reservation','The Arrival Reservation Pad',2010,370,'A reserved free arrival is required before departure.'),landmark('return-gate','The Return Gate',2080,1390,'The public return anchor remains recoverable when another gate collapses.')],{water:[lake('gate-channel',[[1500,50],[1600,50],[1600,1510],[1500,1510]],'lava')]}),
 'dark-spire-towers': L('hell',[
  route('spire-stairs',[[210,1200],[620,1200],[920,900],[1330,900],[1330,440],[1670,440],[1670,1160],[2050,1160],[2050,330]],90,'ash'),route('balcony-return',[[620,1200],[620,350],[1100,350],[1330,440]],78,'ash'),route('service-foot',[[1330,900],[1330,1480],[2180,1480],[2180,1160],[2050,1160]],82,'ash')
 ],[landmark('lower-terminal','The Lower Terminal',1670,440,'This visible control opens the next stair section.'),landmark('upper-pressure','The Upper Pressure Device',2050,330,'An enclosed turn breaks line of effect from the exposed balcony.'),landmark('stair-refuge','The Stair Refuge',2180,1480,'The recovery landing is distinct from an unsupported high balcony.')],{interiors:[hall('spire-interior','Spire Interior',1510,180,720,1350,'tower')],walls:[rect(1790,300,30,480),rect(1870,1000,270,30),rect(1500,1260,380,30)]}),
 'tormented-ruins': L('hell',[
  route('ruin-court',[[220,900],[920,900],[1430,900],[1940,630],[2200,1030]],106,'ash'),route('salvage-trail',[[510,900],[510,410],[1150,410],[1430,900]],80,'ash'),route('sheltered-courtyard',[[510,900],[510,1400],[1490,1400],[2050,1400],[2200,1030]],88,'ash')
 ],[landmark('artifact-marker','The Bound Artifact Marker',1150,410,'The authorized artifact declares its disposition before pickup.'),landmark('broken-court','The Broken Court',1940,630,'Structure durability and the affliction source are inspected separately.'),landmark('recovery-yard','The Recovery Yard',2050,1400,'Permitted salvage records one finite material result.')],{walls:[rect(1460,470,220,32),rect(1580,560,32,170),rect(1770,850,230,32),rect(1680,1150,32,200),rect(1970,1250,180,32)],water:[lake('ruin-fissure',[[750,1240],[860,1240],[860,1660],[750,1660]],'lava')]}),
 'suffering-labyrinths': L('hell',[
  route('labyrinth-entry',[[210,900],[920,900],[1280,900],[1510,900],[1510,400],[1800,400],[1800,1260],[2110,1260],[2110,650],[2310,650]],88,'ash'),route('safe-return',[[920,900],[920,1470],[1510,1470],[2110,1470],[2110,1260]],92,'ash'),route('inner-recovery',[[1510,900],[1800,900]],76,'ash')
 ],[landmark('junction-register','The Junction Register',1510,400,'Map notes preserve the current passage sequence.'),landmark('shifting-controller','The Shifting Controller',2110,650,'A declared state, rather than an unannounced wall, controls the route.'),landmark('persistent-exit','The Persistent Exit',2110,1470,'The Hell release accord preserves a safe departure for every participant.'),landmark('inner-anchor','The Inner Recovery Anchor',1800,1260,'Separated interactions can be coordinated without sharing private inputs.')],{interiors:[hall('labyrinth','The Marked Labyrinth',1370,180,960,1430,'labyrinth')],walls:[rect(1620,230,32,520),rect(1620,1060,32,320),rect(1900,480,32,580),rect(1990,1310,220,32),rect(2170,750,32,390)]})
};

const clone = value => structuredClone(value);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const hub = { x: 920, y: 900 };
const sharedSources = points([[1210,620],[1690,930],[820,820],[1180,1080],[1620,1210],[1760,1320],[620,780],[1210,600],[1750,1180]]);
const distanceToSegment = (p,a,b) => { const d=(b.x-a.x)**2+(b.y-a.y)**2;const t=d?clamp(((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/d,0,1):0;return Math.hypot(p.x-a.x-t*(b.x-a.x),p.y-a.y-t*(b.y-a.y)); };
function inRect(x,y,r,padding=0){return x>=r.x-padding&&x<=r.x+r.width+padding&&y>=r.y-padding&&y<=r.y+r.height+padding;}
export function pointInPolygon(x,y,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if(((a.y>y)!==(b.y>y))&&(x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x))inside=!inside;}return inside;}
export function isOnAuthoredPath(world,x,y,padding=0){return (world.paths||[]).some(path=>path.points.slice(1).some((b,i)=>distanceToSegment({x,y},path.points[i],b)<=path.width/2+padding));}
function subtractRect(a,b){if(a.x>=b.x+b.width||a.x+a.width<=b.x||a.y>=b.y+b.height||a.y+a.height<=b.y)return[a];const left=Math.max(a.x,b.x),right=Math.min(a.x+a.width,b.x+b.width),top=Math.max(a.y,b.y),bottom=Math.min(a.y+a.height,b.y+b.height),out=[];if(top>a.y)out.push({...a,height:top-a.y});if(bottom<a.y+a.height)out.push({...a,y:bottom,height:a.y+a.height-bottom});if(left>a.x)out.push({...a,y:top,width:left-a.x,height:bottom-top});if(right<a.x+a.width)out.push({...a,x:right,y:top,width:a.x+a.width-right,height:bottom-top});return out.filter(r=>r.width>1&&r.height>1);}
function interiorWalls(room){const t=22,x=room.x,y=room.y,w=room.width,h=room.height,door=150;const sides=[rect(x,y,w,t),rect(x,y+h-t,w,t),rect(x,y,t,h),rect(x+w-t,y,t,h)];const cut=room.doorSide==='north'?rect(x+w/2-door/2,y-t,door,t*3):room.doorSide==='west'?rect(x-t,y+h/2-door/2,t*3,door):room.doorSide==='east'?rect(x+w-t*2,y+h/2-door/2,t*3,door):rect(x+w/2-door/2,y+h-t*2,door,t*3);return sides.flatMap(r=>subtractRect(r,cut)).map((r,i)=>({...r,id:`${room.id}:wall-${i}`,solid:true,blocksFlight:true,material:room.floor}));}
function carveRoads(walls,paths){let result=walls;for(const path of paths)for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i],width=path.width+18;const opening=rect(Math.min(a.x,b.x)-width/2,Math.min(a.y,b.y)-width/2,Math.abs(a.x-b.x)+width,Math.abs(a.y-b.y)+width);result=result.flatMap(r=>subtractRect(r,opening));}return result;}
function legacyStreamPolygon(){const left=[],right=[];for(let y=0;y<=1800;y+=30){const x=1420+Math.sin(y/230)*75;left.push({x:x-56,y});right.unshift({x:x+56,y});}return [...left,...right];}
function autoBridges(paths,water){const cells=new Map();for(const path of paths)for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i],d=Math.hypot(b.x-a.x,b.y-a.y);for(let n=0;n<=d;n+=20){const t=d?n/d:0,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;if(water.some(w=>pointInPolygon(x,y,w.points))){const size=path.width+24,cx=Math.round(x/30)*30,cy=Math.round(y/30)*30;cells.set(`${cx}:${cy}`,rect(cx-size/2,cy-size/2,size,size,{id:`bridge:${path.id}:${cx}:${cy}`,pathId:path.id,material:'stone',passable:true}));}}}return [...cells.values()];}
const layoutCache=new Map(),coreLayoutCache=new Map(),entityLayoutCache=new Map(),campaignCache=new Map();
export function getZoneLayout(zoneOrId) {
 const zone = typeof zoneOrId === 'string' ? ZONES.find(z => z.id === zoneOrId) : zoneOrId;
 if (layoutCache.has(zone?.id)) return clone(layoutCache.get(zone.id));
 const record = AUTHORED_LAYOUTS[zone?.id];
 if (!record) throw new Error(`No authored world layout for ${zone?.id}`);
 const data = clone(record), paths = data.roads;
 for (const source of sharedSources) paths.push({...route(`service:${source.x}:${source.y}`,[[hub.x,hub.y],[source.x,source.y]],64,zone.realm==='hell'?'ash':'stone'),hidden:true});
 const water = data.legacy ? [{id:'grove-stream',kind:'water',points:legacyStreamPolygon()}] : data.water;
 const walls = [...data.walls.map((w,i)=>({...w,id:`${zone.id}:wall-${i}`,solid:true})),...data.interiors.flatMap(interiorWalls)];
 const cliffs = data.cliffs.map((c,i)=>({...c,id:`${zone.id}:cliff-${i}`,solid:true,blocksFlight:false}));
 const coreTerrain = {water, walls:carveRoads(walls,paths), cliffs:carveRoads(cliffs,paths), bridges:data.legacy?[rect(1270,882,215,96,{id:'grove-crossing',passable:true})]:autoBridges(paths,water)};
 const landmarks = data.landmarks.map((l,i)=>({...l,id:`${zone.id}:${l.id}`,localId:l.id,asset:`zones/${zone.id}-landmark`,scale:i===0?1:.78,radius:0}));
 const waterfalls = /waterfalls/.test(zone.id)?[{id:`${zone.id}:fall`,x:zone.id==='celestial-waterfalls'?1770:1500,y:zone.id==='celestial-waterfalls'?420:500,width:135,height:220}]:[];
 const core = {id:zone.id,name:zone.name,realm:zone.realm,theme:data.theme,width:2400,height:1800,authored:!data.legacy,legacy:!!data.legacy,spawn:{...hub},ritualAnchor:{x:915,y:736},paths:clone(paths),terrain:clone(coreTerrain),landmarks:clone(landmarks),interiors:clone(data.interiors)};
 // Campaign and legacy save anchors are derived from this unexpanded heart.
 coreLayoutCache.set(zone.id,core);
 const expansion = createRegionExpansion(zone,data.theme,ZONES.findIndex(z=>z.id===zone.id));
 const fullPaths = [...paths,...expansion.roads], fullWater = [...water,...expansion.water], interiors = [...data.interiors,...expansion.interiors];
 const terrain = {water:fullWater,walls:carveRoads([...walls,...expansion.interiors.flatMap(interiorWalls)],fullPaths),cliffs:carveRoads(cliffs,fullPaths),bridges:[...coreTerrain.bridges,...autoBridges(expansion.roads,fullWater)]};
 const frontierLandmarks = expansion.landmarks.map(l=>({...l,id:`${zone.id}:${l.id}`,localId:l.id}));
 const layout = {id:zone.id,name:zone.name,realm:zone.realm,theme:data.theme,width:expansion.width,height:expansion.height,authored:true,legacy:false,layoutVersion:2,spawn:{...hub},ritualAnchor:{x:915,y:736},paths:fullPaths,terrain,landmarks:[...landmarks,...frontierLandmarks],interiors,hamlet:data.hamlet||[],hazardFields:data.hazardFields||[],safeAreas:[{...hub,radius:300},{x:915,y:736,radius:110}],routePuzzles:[],waterfalls,districts:expansion.districts,architecturalFeatures:expansion.architecturalFeatures,discoverySites:frontierLandmarks,habitats:expansion.habitats,resourceAnchors:expansion.resourceAnchors,scenicAssets:expansion.scenicAssets,frontierAccent:expansion.accent,regionDescription:expansion.detail,coreBounds:{x:0,y:0,width:2400,height:1800}};
 layoutCache.set(zone.id,layout); return clone(layout);
}

export function isWorldBlocked(world,x,y,{flying=false,radius=9,ignoreProps=false}={}){
 if(x<30+radius||y<30+radius||x>world.width-30-radius||y>world.height-30-radius)return true;
 const terrain=world.terrain;if(!terrain){if(!flying&&Math.abs(x-(1420+Math.sin(y/230)*75))<56+radius&&Math.abs(y-930)>44-radius)return true;}
 else{if((terrain.walls||[]).some(w=>w.blocking!==false&&w.closed!==false&&inRect(x,y,w,radius)))return true;if(!flying&&(terrain.cliffs||[]).some(c=>inRect(x,y,c,radius)))return true;
  const onBridge=(terrain.bridges||[]).some(b=>inRect(x,y,b,-Math.min(radius,6)));if(!flying&&!onBridge&&(terrain.water||[]).some(w=>pointInPolygon(x,y,w.points)))return true;}
 if(!ignoreProps&&(world.props||[]).some(p=>{const r=p.radius??p.collisionRadius??0;if(r<=0)return false;const limit=r+radius,dx=x-p.x,dy=y-p.y;return Math.abs(dx)<limit&&Math.abs(dy)<limit&&dx*dx+dy*dy<limit*limit;}))return true;return false;
}
export function hasWorldLineOfEffect(world,from,to,{radius=0}={}){const distance=Math.hypot(to.x-from.x,to.y-from.y);for(let n=10;n<distance;n+=10){const x=from.x+(to.x-from.x)*n/distance,y=from.y+(to.y-from.y)*n/distance;if((world.terrain?.walls||[]).some(w=>w.solid!==false&&inRect(x,y,w,radius)))return false;}return true;}
function nearestWalkable(layout,p){if(!isWorldBlocked(layout,p.x,p.y,{ignoreProps:true,radius:12}))return {x:p.x,y:p.y};for(let r=20;r<=300;r+=20)for(let i=0;i<24;i++){const q={x:clamp(p.x+Math.cos(i/24*Math.PI*2)*r,70,layout.width-70),y:clamp(p.y+Math.sin(i/24*Math.PI*2)*r,70,layout.height-70)};if(!isWorldBlocked(layout,q.x,q.y,{ignoreProps:true,radius:12}))return q;}return {x:920,y:900};}
// A point can be on a small isolated bridge tile or behind an interior wall.
// Interaction anchors must have a continuous ordinary ground route from refuge.
function nearestReachable(layout,p){
 const candidate=nearestWalkable(layout,p);
 if(findAuthoredRoute(layout,layout.spawn,candidate).length)return candidate;
 const choices=(layout.paths||[]).flatMap(path=>path.points).map(point=>nearestWalkable(layout,point)).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
 return choices.find(point=>findAuthoredRoute(layout,layout.spawn,point).length)||{...layout.spawn};
}
function endpoints(layout){return layout.landmarks.map(l=>nearestWalkable(layout,l));}
export function getZoneEntityLayout(zoneOrId){const expanded=getZoneLayout(zoneOrId),layout=coreLayoutCache.get(expanded.id)||expanded;if(entityLayoutCache.has(layout.id))return clone(entityLayoutCache.get(layout.id));if(layout.legacy)return {};const locations=endpoints(layout),p0=locations[0],p1=locations[1],p2=locations[2]||locations[0],p3=locations[3]||locations[1];const open=(x,y)=>nearestReachable(layout,{x,y});const overrides={keeper:{x:820,y:820},merchant:{x:1080,y:870},training:{x:1030,y:1005},portal:{x:713,y:955},bridge:open(p1.x-95,p1.y+85),'chest-1':open(p0.x+120,p0.y+90),'chest-2':open(p2.x-110,p2.y+70),'patch-1':open(p0.x-90,p0.y+70),'patch-2':open(p1.x-90,p1.y+70),'patch-3':open(p2.x+90,p2.y+80),'blight-1':open(p0.x+170,p0.y+80),'blight-2':open(p1.x+160,p1.y+100),'blight-3':open(p2.x+150,p2.y+90),guardian:open(p3.x+100,p3.y-90),'encounter-contact-1':open(p0.x-80,p0.y-60),'encounter-contact-2':open(600,650)};
 ['encounter-node-1','encounter-node-2','encounter-node-3'].forEach((id,i)=>{const p=locations[i%locations.length];overrides[id]=open(p.x+75,p.y-40);});
 const resourcePoints=layout.paths.filter(p=>!p.id.startsWith('service:')).flatMap(p=>p.points).filter(p=>Math.hypot(p.x-920,p.y-900)>250);for(let i=0;i<19;i++){const p=resourcePoints[i%resourcePoints.length]||p0;overrides[`resource-${i}`]=open(p.x+(i%3-1)*65,p.y+(i%2?65:-65));}
 entityLayoutCache.set(layout.id,overrides);return clone(overrides);
}
function seeded(seed){let n=seed>>>0;return()=>((n=Math.imul(n,1664525)+1013904223>>>0)/4294967296);}
export function decorateZoneWorld(world,zoneOrId) {
 const zone=typeof zoneOrId==='string'?ZONES.find(z=>z.id===zoneOrId):zoneOrId,layout=getZoneLayout(zone),rng=seeded(world.seed||17);
 const protectedPoints=[...Object.values(getZoneEntityLayout(zone)),...layout.landmarks,...layout.resourceAnchors,...layout.habitats,...sharedSources,{x:915,y:736},{x:820,y:820},{x:1080,y:870},{x:1030,y:1005},{x:713,y:955}];
 Object.assign(world,layout,{layoutId:zone.id,zoneId:zone.id,zoneName:zone.name,realm:zone.realm,variant:layout.theme==='hell'?'infernal':layout.theme});
 const blockedForScenery=p=>Math.hypot(p.x-920,p.y-900)<255||inRect(p.x,p.y,{x:330,y:430,width:340,height:340},25)||isOnAuthoredPath(layout,p.x,p.y,40)||isWorldBlocked(layout,p.x,p.y,{ignoreProps:true,radius:30})||protectedPoints.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<70)||layout.interiors.some(room=>inRect(p.x,p.y,room,15));
 world.props=(world.props||[]).filter(p=>/^(scenery|prop|mushroom)-/.test(p.id)&&!blockedForScenery(p));
 const kit=layout.theme==='hell'?['dead-tree','obsidian-spire','rock-obsidian','brazier']:layout.theme==='heaven'?['tree-heaven','ruin-heaven','floating-island']:layout.theme==='desert'?['palm','cactus','dune','ruin-desert']:layout.theme==='mountain'?['crag','tree-snow','rock-0']:['tree-oak','tree-pine','tree-oak-gold','bush'];
 for(let i=0;i<680;i++){
  const p={x:90+rng()*(layout.width-180),y:90+rng()*(layout.height-180)};
  if(blockedForScenery(p))continue;
  const assets=p.x>2400||p.y>1800?[...kit,...layout.scenicAssets]:kit,asset=assets[Math.floor(rng()*assets.length)];
  world.props.push({id:`authored-scenery-${i}`,kind:asset.includes('tree')||asset==='palm'?'tree':'rock',asset,...p,radius:asset==='floating-island'||asset==='brazier'?0:12,scale:.8+rng()*.65});
 }
 for(const l of layout.landmarks)world.props.push({...l,id:`landmark:${l.id}`,kind:'landmark',radius:0,...(!l.frontier?{anchor:[96,208]}:{})});
 world.props.push({id:'sanctuary-shrine',kind:'shrine',asset:zone.realm==='hell'?'shrine-infernal':zone.realm==='heaven'?'shrine-heaven':'shrine',x:915,y:736,radius:22,scale:1.1},{id:'ancient-arch',kind:'arch',asset:`temple-${zone.realm==='hell'?'infernal':zone.realm==='heaven'?'heaven':layout.theme==='desert'?'desert':'forest'}`,x:1000,y:635,radius:0,scale:1.08});
 for(const [i,p]of layout.hamlet.entries())world.props.push({id:`authored-house-${i}`,kind:'house',asset:`vendor/superpowers/background-elements/${[1,9,16][i%3]}`,...p,scale:3,anchor:i%3===0?[15,28]:i%3===1?[8,18]:[8,22],radius:24});
 for(const district of layout.districts.filter(d=>d.kind==='settlement'))for(let i=0;i<8;i++){
  const p={x:district.x+(i%4-1.5)*170,y:district.y+(i<4?-215:210)};
  if(blockedForScenery(p))continue;
  world.props.push({id:`district-house:${district.id}:${i}`,kind:'house',asset:zone.realm==='hell'?'ruin-infernal':zone.realm==='heaven'?'ruin-heaven':`vendor/superpowers/background-elements/${[1,9,16][i%3]}`,...p,scale:zone.realm==='earth'?3.5:1.3,radius:18,...(zone.realm==='earth'?{anchor:i%3===0?[15,28]:i%3===1?[8,18]:[8,22]}:{})});
 }
 for(const room of layout.interiors){const count=Math.max(2,Math.floor(room.width/180));for(let j=0;j<count;j++){
  const p={x:room.x+85+j*(room.width-150)/Math.max(1,count-1),y:room.y+95};if(isOnAuthoredPath(world,p.x,p.y,35))continue;
  world.props.push({id:`interior-${room.id}-${j}`,kind:'interior-prop',asset:`vendor/superpowers/background-elements/${room.theme==='library'?2:room.theme==='pyramid'?14:room.theme==='citadel'?15:16}`,...p,scale:3,anchor:[8,20],radius:10});
 }}
 world.props=world.props.filter(p=>!(p.radius>0&&protectedPoints.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<70)&&p.id!=='sanctuary-shrine'));
 world.decor=(world.decor||[]).filter(p=>!isWorldBlocked(world,p.x,p.y,{ignoreProps:true,radius:0}));
 for(let i=0;i<1350;i++){const p={x:rng()*layout.width,y:rng()*layout.height};if((p.x>2400||p.y>1800)&&!isWorldBlocked(world,p.x,p.y,{ignoreProps:true,radius:0}))world.decor.push({...p,type:i%4?'grass':'mote',seed:rng()});}
 world.ambient ||= [];
 for(let i=0;i<32;i++){const p={x:250+rng()*(layout.width-500),y:1900+rng()*(layout.height-2150)};if(isWorldBlocked(world,p.x,p.y,{ignoreProps:true,radius:5}))continue;world.ambient.push({id:`frontier-wildlife-${i}`,...p,homeX:p.x,homeY:p.y,sprite:zone.realm==='hell'?['moth','firefly'][i%2]:['deer','wildlife/rabbit','wildlife/songbird','wildlife/butterfly'][i%4],phase:rng()*Math.PI*2});}
 world.pathPoints=layout.paths.flatMap(p=>p.points); return world;
}

export function createWorldEntities(zoneOrId) {
 const zone=typeof zoneOrId==='string'?ZONES.find(z=>z.id===zoneOrId):zoneOrId,layout=getZoneLayout(zone),index=ZONES.findIndex(z=>z.id===zone.id),next=ZONES[(index+1)%ZONES.length];
 const out=layout.landmarks.map(l=>({id:`world-site:${l.id}`,x:l.x,y:l.y,kind:'world-landmark',role:'world-landmark',sprite:'ruin',name:l.name,description:l.description,protected:true,landmarkId:l.id,frontier:!!l.frontier,districtId:l.districtId,discoveryRadius:l.discoveryRadius||160}));
 const p=nearestWalkable(layout,{x:2200,y:1560});
 out.push({id:`route-portal:${zone.id}`,kind:'portal',role:'route-portal',...p,sprite:'portal',asset:`zones/${zone.id}-portal`,name:`Passage to ${next.name}`,description:`Stable route to ${next.name}. The public return and sanctuary recall remain available.`,destination:next.id,protected:true});
 const materialNames={herb:'Moonleaf',crystal:'Resonant Crystal',wood:'Sacred Timber',stone:'Runestone'};
 for(const anchor of layout.resourceAnchors){const pos=nearestWalkable(layout,anchor);out.push({...anchor,...pos,kind:'resource',sprite:anchor.item,name:materialNames[anchor.item],description:'A renewable frontier material node. Gather it, then allow the habitat to replenish away from nearby travelers.',renewable:true,respawnSeconds:90,spawnGroup:'frontier',home:{...pos},spawn:{...pos},spawnGeneration:0});}
 const prototypes=createRegionalEncounters(zone,zone.minRank||1,700+index).filter(e=>e.kind==='enemy'&&!e.boss);
 for(const [i,habitat]of layout.habitats.entries())for(let j=0;j<6;j++){
  const angle=j/6*Math.PI*2,pos=nearestWalkable(layout,{x:habitat.x+Math.cos(angle)*110,y:habitat.y+Math.sin(angle)*110});
  const n=clone(prototypes[(i+j)%prototypes.length]);
  Object.assign(n,{id:`frontier-enemy:${zone.id}:${i}:${j}`,...pos,home:{...pos},spawn:{...pos},boss:false,worldBoss:false,renewable:true,respawnSeconds:120,spawnGroup:habitat.id,spawnGeneration:0,frontier:true});out.push(n);
 }
 return out;
}



// An objective's identity is global. Contracts records inspected evidence before
// acceptance, keeps cargo bound, and pays the final chosen outcome once.
const SCENARIOS = {
 'ethereal-sanctuary':[
 ['investigation','A Deliberate Beginning','Inspect the arrival rules, compare a training target, and report the exact cancellation procedure.'],
 ['delivery','A Lamp for the Quiet Terrace','Carry a bound public lamp from the terrace quartermaster to the quiet garden.'],
 ['allocation','The First Gathering','Allocate a finite recovery lot among the public terrace and its training court.']
 ],
 'divine-cities':[
 ['investigation','Receipts Before Rumours','Compare the project ledger with the market receipt and present the matching evidence.'],
 ['delivery','A Civic Commission','Carry a sealed civic parcel through the public service lane to the repair yard.'],
 ['negotiation','Passage by Permission','Acquire a civic permit by verification or commit a clearly posted coercive alternative.']
 ],
 'halls-of-knowledge':[
 ['investigation','The Indexed Proof','Read the index terminal, inspect the reading record, and cite both evidence identifiers.'],
 ['delivery','A Record on Loan','Move a bound research record from the proof desk to the reading court.'],
 ['mechanism','The Quiet Index','Align three visible catalogue states in their posted order.']
 ],
 'ethereal-libraries':[
 ['investigation','The Unaltered Record','Compare the open vault, catalogue gallery, and return record without inventing an answer.'],
 ['delivery','Return What Was Borrowed','Deliver a quest-bound catalogue volume to its named return desk.'],
 ['negotiation','Access to the Archive','Present the verified borrowing chain to negotiate access to the respite archive.']
 ],
 'ethereal-gardens':[
 ['investigation','Where the Water Ends','Trace an irrigation link from the upper beds to the lower orchard.'],
 ['restoration','One Bed, One Harvest','Restore a damaged bed or contribute the posted plant fibre without creating another harvest identity.'],
 ['allocation','The Finite Orchard','Share the authorized mature crop lot between irrigation workers and the public garden.']
 ],
 'celestial-waterfalls':[
 ['investigation','Before the Surge','Inspect the flow warning and compare the protected lower crossing.'],
 ['mechanism','A Crossing Interval','Align the three visible stabilizers and open the declared crossing interval.'],
 ['escort','Behind the Falling Water','Escort a consenting surveyor along the sheltered ground ledge.']
 ],
 'palatial-halls':[
 ['investigation','A Proposal with Evidence','Inspect the public audience policy and identify the owner of the proposed service project.'],
 ['delivery','The Public Petition','Carry a sealed project proposal through the visitor balcony to the audience court.'],
 ['negotiation','The Open Hearing','Resolve the hearing through verified evidence or an explicitly classified pressure tactic.']
 ],
 'celestial-palaces':[
 ['investigation','Three Wings, Three Owners','Read each wing’s public boundary before choosing an approach.'],
 ['escort','A Guest’s Safe Passage','Escort an invited visitor along the public gallery rather than through a restricted wing.'],
 ['allocation','The Palace Commons','Distribute a finite garden contribution without granting unrelated withdrawal rights.']
 ],
 'astral-observatory':[
 ['investigation','The Visible Meridian','Observe all three instruments and record their exact current states.'],
 ['mechanism','A Window in the Sky','Set the visible dial sequence; missing a window resets no unrelated objective.'],
 ['delivery','An Alignment Report','Deliver the sealed observation report to the horizon platform.']
 ],
 'celestial-observatories':[
 ['investigation','A Triangulated Observation','Compare the western, eastern, and southern arrays.'],
 ['mechanism','The Three-Array Alignment','Apply the posted alignment order at each physical instrument.'],
 ['negotiation','Accord of the High Terraces','Present the complete instrument chain and settle the Heaven access accord.']
 ],
 'eternal-light-fields':[
 ['investigation','Light Has a Boundary','Distinguish decorative light from the tagged pressure field and inspect its source.'],
 ['allocation','A Place of Respite','Contribute a finite shelter lot to establish an ordinary rest point.'],
 ['escort','Across the Open Fields','Escort a consenting keeper between the dawn shelter and respite ring.']
 ],
 'iridescent-temples':[
 ['investigation','Name the Imposed Condition','Identify the specific removable affliction and inspect the temple’s trial policy.'],
 ['restoration','A Measured Cleansing','Restore the marked ecological source through an eligible local action or a material contribution.'],
 ['mechanism','The Prism’s Three States','Complete the visible trial sequence without substituting a broad destructive power.']
 ],
 'translucent-bridges':[
 ['investigation','A Span Before Departure','Inspect both arrival anchors and the current cargo restriction.'],
 ['delivery','The Span Component','Carry one bound component to the public span repair marker.'],
 ['escort','Permission to Cross','Escort a consenting traveller over the safe public span.']
 ],
 'celestial-sanctuaries':[
 ['investigation','Rights at the Threshold','Compare visitor, contributor, and withdrawal permissions at the refuge.'],
 ['delivery','A Recovery Chest Prepared','Carry a sealed storage component to the public recovery store.'],
 ['allocation','A Home with an Exit','Allocate building materials while preserving the protected arrival and departure lanes.']
 ],
 'majestic-mountain-ranges':[
 ['investigation','The Ground Pass Remains','Survey both passes and compare the sheltered route with the exposed ridge.'],
 ['delivery','A Ridge Anchor Repaired','Deliver a bound route component through the stable mountain pass.'],
 ['escort','Cargo in the Valley','Escort a consenting carrier along the valley’s weather-safe route.']
 ],
 'sacred-groves':[
 ['investigation','The Grove’s Evidence','Inspect the Moonleaf clearing and old ruins to distinguish damaged habitat from the guardian’s state.'],
 ['delivery','Moonleaf for the Keeper','Carry a bound Moonleaf parcel from the grove quartermaster to the sanctuary keeper.'],
 ['negotiation','The Grove Charter','Settle a fair finite-harvest agreement and preserve the sanctuary’s public paths.']
 ],
 'prismatic-waterfalls':[
 ['investigation','The Source Beneath the Spray','Identify the actual flow valve and the lower-bank surge marker.'],
 ['mechanism','The Prismatic Crossing','Apply the marked three-valve sequence to stabilize the public crossing.'],
 ['delivery','A Permitted Recovery','Recover a quest-bound survey cache from the safe ledge and deliver it to the lower bank.']
 ],
 'cosmic-deserts':[
 ['investigation','The Stone Compass','Compare the refuge markers and the visible alignment at the sunken gate.'],
 ['mechanism','The Corridor Opens','Restore the posted gate sequence through the stone corridor.'],
 ['allocation','A Finite Oasis','Allocate a bounded restoration lot to the oasis project rather than treating it as unlimited supplies.']
 ],
 'city-of-stars':[
 ['investigation','The Market Window','Observe the star clock and verify the public departure reservation.'],
 ['delivery','An Accord in Transit','Carry the sealed world-project ledger from the alignment market to the concordance dais.'],
 ['trial','The Three-Realm Concordance','Bring the Earth charter, Heaven accord, and Hell release together at celestial rank ten.']
 ],
 'sacred-temples':[
 ['investigation','What the Witness Saw','Collect an evidence chain that distinguishes imposed magic from an ordinary resource dispute.'],
 ['restoration','Remove the Source','Restore the marked source without deleting the witness record.'],
 ['negotiation','An Allocation Reconciled','Use verified evidence to agree a finite resource allocation.']
 ],
 'ancient-pyramids':[
 ['investigation','A Mechanism, Not a Password','Inspect the entry mechanism and the actual movable component.'],
 ['mechanism','The Three Chambers','Set the visible chamber controls in the declared order.'],
 ['delivery','The Bound Survey Artifact','Carry the authorized artifact to the lower ramp without converting it to saleable loot.']
 ],
 'sanctified-cathedrals':[
 ['investigation','Evidence in the Side Aisle','Inspect the vestry record and gallery witness before making a claim.'],
 ['escort','A Public Recovery Route','Escort a consenting injured keeper through the sheltered service aisle.'],
 ['allocation','The Nave Prepared','Contribute finite recovery materials to the public gathering.']
 ],
 'zen-gardens':[
 ['investigation','A Stone with an Owner','Inspect the protected decorative stones and the permitted offering bed.'],
 ['mechanism','The Aligned Crossing','Read and align the stepping-stone markers in their visible order.'],
 ['negotiation','A Gift Freely Given','Meet the posted garden need without treating a decorative gift as a tradable resource lot.']
 ],
 'sacred-monuments':[
 ['investigation','A Crack and a Crowd','Inspect the structural crack separately from public morale pressure.'],
 ['delivery','The Named Repair Component','Deliver a bound repair component identified by the public evidence stones.'],
 ['negotiation','The Assembly’s Decision','Present the structural evidence and settle a public repair allocation.']
 ],
 'living-settlements':[
 ['investigation','Follow the Posted Need','Compare the civic board, finite stock ledger, and isolated service route.'],
 ['delivery','A Workshop Commission','Deliver a sealed component from the craft court to the service bridge.'],
 ['allocation','The Commons Receipt','Distribute public materials with an explicit contribution receipt.']
 ],
 'forests-plains-and-lakes':[
 ['investigation','Observe Before Approaching','Record the territorial creature’s tell and mark an alternate lake route.'],
 ['escort','The Lakeshore Detour','Escort a consenting gatherer along the safe lakeshore.'],
 ['allocation','The Authorized Harvest','Divide a finite harvest between ecological recovery and the public refuge.']
 ],
 'infernal-abyss':[
 ['investigation','The Marked Fissure','Compare the stable shelf with the actual tagged pressure source.'],
 ['delivery','A Shelter on the Lower Shelf','Carry a bound refuge component along the recoverable ground route.'],
 ['mechanism','Pressure Released','Apply the posted source sequence to stabilize the abyss project.']
 ],
 'malevolent-citadels':[
 ['investigation','The Gate’s True Owner','Inspect the permit panel and the eligible service route before entering the compound.'],
 ['delivery','An Exchange under Receipt','Carry a sealed trade docket to the citadel exchange.'],
 ['negotiation','A Citadel Permit','Present evidence for service access or choose the posted coercive alternative.']
 ],
 'realm-of-eternal-conflict':[
 ['investigation','Who Is Participating','Verify each rally’s encounter boundary and identify the neutral service table.'],
 ['delivery','A Neutral Proposal','Carry a sealed ceasefire proposal between the declared rally points.'],
 ['negotiation','A Lane at Peace','Settle the authored lane dispute without forcing a party into an encounter.']
 ],
 'pits-of-suffering':[
 ['investigation','The Pulse Before the Affliction','Inspect the emitter’s tell and the recovery threshold.'],
 ['mechanism','The Emitter Silenced','Set the three visible controls to stop the affliction source.'],
 ['escort','An Identity Recovered','Escort an eligible recovered game identity to the marked refuge.']
 ],
 'forsaken-wastelands':[
 ['investigation','A Safe Line through Ash','Survey the fissure marker and the ground shelter chain.'],
 ['delivery','The Depleted Project','Carry a bound restoration component from the refuge to the depleted site.'],
 ['allocation','The Recovery Lot','Allocate finite material lots to the depleted project and the public shelter.']
 ],
 'chaos-chasms':[
 ['investigation','The Landing Exists','Inspect each distinct arrival pad and the current counterweight state.'],
 ['mechanism','Three Timed Controls','Read and set the declared multi-point crossing sequence.'],
 ['escort','Across the Stable Bypass','Escort a consenting mechanism keeper along the ground bypass.']
 ],
 'malevolence-forest':[
 ['investigation','The Revealing Outline','Observe the real source before chasing any decoy beyond the trail.'],
 ['restoration','The Tagged Roots','Restore the removable root source or donate the posted ecological materials.'],
 ['negotiation','A Route through Cover','Present the trail evidence to obtain passage or commit an explicit intimidation outcome.']
 ],
 'pits-of-despair':[
 ['investigation','The Source of Lost Assistance','Inspect the morale emitter and the separate recovery identity.'],
 ['mechanism','The Morale Field Ends','Set the posted emitter states in their visible order.'],
 ['escort','Return to the Resolve Shelter','Escort a consenting recovered identity after disabling its pressure source.']
 ],
 'infernal-strongholds':[
 ['investigation','The Actual Control Node','Distinguish the authorized defense project from unrelated property.'],
 ['delivery','The Quartermaster’s Component','Carry a sealed service component to the southern ward.'],
 ['negotiation','An Entrance Preserved','Negotiate a service permit or commit a classified coercive demand.']
 ],
 'infernal-gates':[
 ['investigation','Read the Destination Panel','Compare the authoritative destination with the actual arrival reservation.'],
 ['delivery','The Gate Component','Deliver the bound repair component to the public return anchor.'],
 ['mechanism','A Reserved Return','Align the gate’s visible states while preserving a free departure route.']
 ],
 'dark-spire-towers':[
 ['investigation','The Valid Landing','Inspect the lower terminal and the actual supported balcony.'],
 ['mechanism','The Stair Device','Set the marked pressure device through the enclosed-turn route.'],
 ['delivery','A Terminal Restored','Carry an authorized terminal component to the upper pressure device.']
 ],
 'tormented-ruins':[
 ['investigation','Two Separate Failures','Inspect the wall’s durability and the affliction source behind it.'],
 ['delivery','The Marked Artifact','Carry the quest-bound recovery artifact to the sheltered yard.'],
 ['allocation','Repair before Salvage','Allocate finite materials to the authorized repair rather than claiming repeated salvage.']
 ],
 'suffering-labyrinths':[
 ['investigation','The Junction Record','Inspect the marked junctions and retain their visible route sequence.'],
 ['mechanism','The Shifting Controller','Apply the declared route state without closing the persistent exit.'],
 ['negotiation','Release of the Labyrinth','Settle the Hell release accord and preserve a safe departure for every participant.']
 ]
};

export function findAuthoredRoute(world,start,end,{step=30}={}){const cols=Math.ceil(world.width/step),rows=Math.ceil(world.height/step),key=(x,y)=>y*cols+x;const s={x:clamp(Math.floor(start.x/step),1,cols-2),y:clamp(Math.floor(start.y/step),1,rows-2)},goal={x:clamp(Math.floor(end.x/step),1,cols-2),y:clamp(Math.floor(end.y/step),1,rows-2)},queue=[s],visited=new Set([key(s.x,s.y)]),parents=new Map();let found=null;for(let at=0;at<queue.length&&at<cols*rows;at++){const n=queue[at];if(Math.hypot(n.x-goal.x,n.y-goal.y)<=1){found=n;break;}for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=n.x+dx,y=n.y+dy,k=key(x,y);if(x<1||y<1||x>=cols-1||y>=rows-1||visited.has(k)||isWorldBlocked(world,x*step+step/2,y*step+step/2,{ignoreProps:true,radius:8}))continue;visited.add(k);parents.set(k,key(n.x,n.y));queue.push({x,y});}}if(!found)return[];let k=key(found.x,found.y),initial=key(s.x,s.y),raw=[];while(k!==initial){raw.push({x:(k%cols)*step+step/2,y:Math.floor(k/cols)*step+step/2});k=parents.get(k);if(k==null)break;}raw.reverse();const route=[];for(let i=0;i<raw.length;i++){const a=raw[i-1],b=raw[i],c=raw[i+1];if(!a||!c||(b.x-a.x)!==(c.x-b.x)||(b.y-a.y)!==(c.y-b.y))route.push(b);}route.push({...end});return route;}
function campaignId(zone,index){return `campaign:${zone.id}:${index+1}`;}
function stepId(zone,index,part){return `${campaignId(zone,index)}:${part}`;}
function campaignStep(zone,index,type,p,fields={}){const id=stepId(zone,index,fields.key||type);return{id,type,targetId:`contract-site:${id}`,name:fields.name||`${zone.name} · ${type}`,x:Math.round(p.x),y:Math.round(p.y),radius:95,...fields};}
function bodyFor(zone,index,definition,layout){const [type,title,description]=definition,locations=endpoints(layout),a=locations[index%locations.length],b=locations[(index+1)%locations.length],c=locations[(index+2)%locations.length],keeper={x:820,y:820};const sourceName=i=>layout.landmarks[i%layout.landmarks.length].name;let steps=[];
 if(type==='investigation'){const first=campaignStep(zone,index,'inspect',a,{key:'evidence-a',name:sourceName(index),evidence:`${zone.id}:record-a`}),second=campaignStep(zone,index,'inspect',b,{key:'evidence-b',name:sourceName(index+1),evidence:`${zone.id}:record-b`});steps=[first,second,campaignStep(zone,index,'negotiate',keeper,{key:'verify',name:'The Public Evidence Desk',requiresEvidence:[first.id,second.id],choices:[{id:'verify',label:'Present the two inspected records',effect:'verify',requiresEvidence:[first.id,second.id],reputationDelta:5,currency:'good'},{id:'pressure',label:'Pressure the desk to accept the report · Bad Karma',effect:'coerce',reputationDelta:-10,currency:'bad'}]})];}
 else if(type==='delivery'){const cargo={id:`bound-cargo:${zone.id}:${index}`,name:`${title} · sealed parcel`,quantity:1};steps=[campaignStep(zone,index,'pickup',a,{key:'collect',name:sourceName(index),cargo}),campaignStep(zone,index,'deliver',b,{key:'deliver',name:sourceName(index+1),cargo})];}
 else if(type==='escort'){const route=findAuthoredRoute(layout,a,b);steps=[campaignStep(zone,index,'escort',a,{key:'escort',name:`Consenting ${zone.realm==='hell'?'wayfarer':'surveyor'}`,waypoints:route.length?route:[{...hub},b],destination:b,speed:75,consent:true})];}
 else if(type==='allocation'){steps=[campaignStep(zone,index,'allocate',a,{key:'allocate',name:sourceName(index),items:{wood:2,stone:1},choices:[{id:'fair',label:'Allocate 2 timber and 1 runestone to the public project',effect:'fair',items:{wood:2,stone:1},reputationDelta:5,currency:'good'},{id:'commandeer',label:'Commande­er the public allocation · Bad Karma',effect:'coerce',items:{wood:1},reputationDelta:-10,currency:'bad'}]})];}
 else if(type==='restoration'){steps=[campaignStep(zone,index,'restore',a,{key:'restore',name:sourceName(index),power:{branchId:'water-grow',level:1},items:{herb:2},choices:[{id:'restore',label:'Restore the tagged source with a learned local power',effect:'repair',currency:'good'},{id:'donate',label:'Contribute 2 Moonleaf to the recovery project',items:{herb:2},effect:'fair',currency:'good'},{id:'exhaust',label:'Exhaust the tagged source · 1 crystal · Bad Karma',items:{crystal:1},effect:'coerce',reputationDelta:-10,currency:'bad'}]})];}
 else if(type==='mechanism'){steps=[campaignStep(zone,index,'mechanism',a,{key:'mechanism-a',name:`${sourceName(index)} · control I`,sequence:[1,2,3]}),campaignStep(zone,index,'mechanism',b,{key:'mechanism-b',name:`${sourceName(index+1)} · control II`,sequence:[2,3,1]}),campaignStep(zone,index,'mechanism',c,{key:'mechanism-c',name:`${sourceName(index+2)} · control III`,sequence:[3,1,2]})];}
 else if(type==='negotiation'){const evidence=campaignStep(zone,index,'inspect',a,{key:'terms',name:`${sourceName(index)} · posted terms`});steps=[evidence,campaignStep(zone,index,'negotiate',b,{key:'agreement',name:sourceName(index+1),requiresEvidence:[evidence.id],choices:[{id:'fair',label:'Present the evidence and preserve public access',effect:'fair',requiresEvidence:[evidence.id],reputationDelta:5,currency:'good'},{id:'coerce',label:'Impose the posted demand · Bad Karma',effect:'coerce',reputationDelta:-10,currency:'bad'},{id:'leave',label:'Leave the decision open',effect:'leave',reputationDelta:0}]})];}
 else if(type==='trial'){steps=[campaignStep(zone,index,'inspect',a,{key:'read-accords',name:'The Three Realm Accord Register'}),campaignStep(zone,index,'mechanism',b,{key:'align-concordance',name:'The Concordance Alignment',sequence:[1,3,2]}),campaignStep(zone,index,'negotiate',c,{key:'ratify',name:'The Concordance Dais',choices:[{id:'ratify',label:'Ratify the reversible concordance',effect:'fair',currency:'good',reputationDelta:5}]})];}
 return{type,title,description,steps};}
export function getAuthoredCampaign(zoneOrId){const zone=typeof zoneOrId==='string'?ZONES.find(z=>z.id===zoneOrId):zoneOrId;if(!zone)return null;if(campaignCache.has(zone.id))return clone(campaignCache.get(zone.id));const layout=getZoneLayout(zone),definitions=SCENARIOS[zone.id];const objectives=definitions.map((definition,index)=>{const body=bodyFor(zone,index,definition,coreLayoutCache.get(zone.id)||layout);return{id:campaignId(zone,index),zoneId:zone.id,...body,chapter:zone.realm,requiredRank:Math.min(zone.minRank||1,6),prerequisites:index?[campaignId(zone,index-1)]:[],reward:{amount:25*Math.max(1,zone.minRank||1)*(index+1),currency:'good'},location:{...body.steps[0]},alternatives:body.steps.flatMap(s=>(s.choices||[]).filter(c=>c.currency==='bad').map(c=>({id:c.id,title:c.label,currency:'bad',consequence:'A coercive outcome is recorded independently from the wallet.'}))),failureTerms:'Leaving or being downed pauses the objective. Bound cargo cannot be sold; no unrelated belongings are confiscated.',recoveryTerms:'Return to the recorded source or the public refuge. Settled steps and unique reward receipts remain recorded.'};});
 if(zone.id==='infernal-gates'){
  const trial=objectives[2];trial.grantsPortalAccess=true;trial.portalAccessTrial=true;trial.title='A Reserved Return · Portal Access Trial';
  trial.description='Align all three visible gate controls while preserving a free return route. Settling this explicit access trial grants permission to fabricate an owned portal anchor; materials, recipe training, and Fire–Create requirements remain separate.';
  const final=trial.steps.at(-1);final.grantsPortalAccess=true;final.name+=' · portal access authorization';final.description='Complete this final posted sequence to earn portal-anchor access. The full trial receipt is settled at the public return anchor.';
 }
 if(zone.id==='sacred-groves')objectives[2].milestone='earth:charter';if(zone.id==='celestial-observatories')objectives[2].milestone='heaven:accord';if(zone.id==='suffering-labyrinths')objectives[2].milestone='hell:release';if(zone.id==='city-of-stars'){const final=objectives[2];final.requiredRank=10;final.prerequisites.push('campaign:sacred-groves:3','campaign:celestial-observatories:3','campaign:suffering-labyrinths:3');final.ending=true;final.milestone='world:concordance';final.summary='The three realm accords are ratified. Your rank-ten character retains free exploration, sanctuaries, reversible rituals, companions, and all settled ownership. The final accord is a world condition, not an end to local exit or player choice.';final.reward={amount:1000,currency:'good'};}
 const campaign={id:`campaign:${zone.id}`,zoneId:zone.id,title:`${zone.name} · ${definitions[0][1]}`,description:zone.description,chapter:zone.realm,manualPage:zone.manualPage,objectives,landmarks:layout.landmarks.map(l=>({id:l.id,name:l.name,x:l.x,y:l.y})),routeSummary:layout.paths.filter(p=>!p.hidden).map(p=>p.id).join(' · '),ending:zone.id==='city-of-stars'};campaignCache.set(zone.id,campaign);return clone(campaign);
}
export const CAMPAIGN_CHAPTERS=[{id:'earth',title:'A Place in the Living World',milestone:'earth:charter',keyObjective:'campaign:sacred-groves:3',description:'Inspect, restore, exchange, and establish the grove’s public charter.'},{id:'heaven',title:'The High Terrace Accord',milestone:'heaven:accord',keyObjective:'campaign:celestial-observatories:3',description:'Verify the three arrays and establish a coordinated Heaven access accord.'},{id:'hell',title:'A Recoverable Passage',milestone:'hell:release',keyObjective:'campaign:suffering-labyrinths:3',description:'Read the labyrinth’s controls and preserve its public recovery route.'},{id:'concordance',title:'The Three-Realm Concordance',milestone:'world:concordance',keyObjective:'campaign:city-of-stars:3',requiredRank:10,description:'At celestial rank ten, ratify the three accords without erasing settled consequences.'}];

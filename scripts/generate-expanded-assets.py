"""Original illustrated catalog, spell animation, architecture and character kit.
Run after generate-assets.py. Pillow-only generation; no third-party source art.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import subprocess,json,math,random,hashlib

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'public/assets';TAU=math.tau
DATA=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import{BRANCHES,ENHANCEMENTS,TECHNIQUES,ZONES}from'./src/data/manual.js';console.log(JSON.stringify({branches:BRANCHES,enhancements:ENHANCEMENTS,techniques:TECHNIQUES,zones:ZONES}));"],cwd=ROOT))
M={'version':1,'license':'Original Eternal Powers project artwork. No third-party source pixels.','generator':'scripts/generate-expanded-assets.py','powerIcons':{},'enhancementIcons':{},'techniqueIcons':{},'equipment':{},'vfx':{},'props':{},'characters':{}}
def cv(w,h):
 im=Image.new('RGBA',(w,h));return im,ImageDraw.Draw(im)
def rgb(s):return tuple(bytes.fromhex(s.lstrip('#')))
def mix(a,b,t):return tuple(int(x+(y-x)*t) for x,y in zip(rgb(a) if isinstance(a,str) else a,rgb(b) if isinstance(b,str) else b))
def seed(s):return int(hashlib.sha256(s.encode()).hexdigest()[:8],16)
def save(im,path,group,**meta):
 p=OUT/path;p.parent.mkdir(parents=True,exist_ok=True);im.save(p);M[group][path[:-4]]={'src':'/assets/'+path,'width':im.width,'height':im.height,**meta}
def star(d,x,y,r,color):d.polygon([(x,y-r),(x+r*.28,y-r*.28),(x+r,y),(x+r*.28,y+r*.28),(x,y+r),(x-r*.28,y+r*.28),(x-r,y),(x-r*.28,y-r*.28)],fill=color)
def heart(d,x,y,s,color):
 d.polygon([(x,y+s*.8),(x-s,y-s*.2),(x-s,y-s*.65),(x-s*.5,y-s),(x,y-s*.5),(x+s*.5,y-s),(x+s,y-s*.65),(x+s,y-s*.2)],fill=color)
def drop(d,x,y,r,color):d.polygon([(x,y-r),(x-r*.8,y+r*.3),(x-r*.65,y+r),(x+r*.65,y+r),(x+r*.8,y+r*.3)],fill=color)
def glyph(d,kind,x,y,r,c,light):
 if kind=='shield':d.polygon([(x-r,y-r),(x+r,y-r),(x+r*.8,y+r*.35),(x,y+r),(x-r*.8,y+r*.35)],fill=c);d.line((x,y-r*.6,x,y+r*.5),fill=light,width=2)
 elif kind=='chain':
  for k in range(-1,2):d.ellipse((x-r+k*r*.5,y-r*.4+k*r*.4,x-r*.1+k*r*.5,y+r*.4+k*r*.4),outline=c,width=2)
 elif kind=='heart':heart(d,x,y,r,c);d.line((x-r*.5,y-r*.5,x-r*.2,y-r*.65),fill=light,width=2)
 elif kind=='drop':drop(d,x,y,r,c);d.line((x-r*.3,y,x-r*.3,y+r*.5),fill=light,width=2)
 elif kind=='flame':d.polygon([(x,y-r),(x-r*.25,y),(x-r*.7,y-r*.2),(x-r,y+r*.45),(x-r*.3,y+r),(x+r*.6,y+r*.8),(x+r,y+r*.2),(x+r*.4,y-r*.35),(x+r*.25,y+r*.25)],fill=c);d.polygon([(x,y),(x-r*.35,y+r*.55),(x,y+r*.8),(x+r*.35,y+r*.5)],fill=light)
 elif kind=='leaf':d.polygon([(x-r,y+r),(x-r*.8,y-r*.2),(x,y-r),(x+r,y-r),(x+r*.75,y+r*.25),(x,y+r)],fill=c);d.line((x-r*.9,y+r,x+r*.65,y-r*.65),fill=light,width=2)
 elif kind=='moon':d.ellipse((x-r,y-r,x+r,y+r),fill=c);d.ellipse((x-r*.05,y-r*1.15,x+r*1.15,y+r*.1),fill='#263b3b');star(d,x+r*.7,y-r*.55,r*.25,light)
 elif kind=='sun':
  d.ellipse((x-r*.55,y-r*.55,x+r*.55,y+r*.55),fill=c)
  for i in range(8):a=i*TAU/8;d.line((x+math.cos(a)*r*.75,y+math.sin(a)*r*.75,x+math.cos(a)*r,y+math.sin(a)*r),fill=light,width=2)
 elif kind=='wind':
  for j in [-1,0,1]:d.arc((x-r*.35,y+j*r*.55-r*.35,x+r,y+j*r*.55+r*.35),190,490,fill=c,width=2);d.line((x-r,y+j*r*.55+r*.25,x+r*.25,y+j*r*.55+r*.25),fill=c,width=2)
 else:star(d,x,y,r,c);star(d,x,y,r*.35,light)

def frame_icon(identity,color,level,kind='power',base=None,shape=None):
 im,d=cv(48,48);r=random.Random(seed(identity));dark=mix(color,'#172c30',.82);rim=mix(color,'#c8b276',.5);light=mix(color,'#f5edc9',.7)
 d.rounded_rectangle((2,2,45,45),radius=8,fill=(*dark,244),outline='#637163',width=1)
 d.rounded_rectangle((4,4,43,43),radius=7,outline=(*rim,190),width=1)
 for yy in range(7,42,3):
  for xx in range(7,42,3):
   if r.random()<.13:d.point((xx,yy),fill=(*mix(color,'#263c3a',.72),170))
 if level>=2:d.arc((7,7,41,41),20,160,fill=rim,width=1);d.arc((7,7,41,41),200,340,fill=rim,width=1)
 if level>=4:d.polygon([(24,5),(43,24),(24,43),(5,24)],outline=(*rim,190))
 if level>=7:
  for i in range(8):a=TAU*i/8;star(d,24+math.cos(a)*18,24+math.sin(a)*18,1.6,light)
 if base:
  g=Image.open(base).convert('RGBA');g=g.resize((27,27),Image.Resampling.NEAREST);im.alpha_composite(g,(10,9))
 else:glyph(d,shape or 'star',24,22,10,color,light)
 d=ImageDraw.Draw(im)
 # The ornament depicts increasing scope, rather than a printed level number.
 if level<=3:
  for j in range(level):d.polygon([(20+j*4,39),(22+j*4,37),(24+j*4,39),(22+j*4,41)],fill=light)
 elif level==4:
  for x,y in [(8,8),(40,8),(8,40),(40,40)]:star(d,x,y,2.2,light)
 elif level==5:
  for x in [17,23,29]:d.rectangle((x,36,x+3,40),fill=rim);d.polygon([(x-1,36),(x+1.5,33),(x+4,36)],fill=light)
 elif level==6:
  for x in [17,22,27,32]:d.rectangle((x,35+(x%3),x+2,41),fill=rim)
  d.line((16,41,35,41),fill=light)
 elif level==7:d.arc((10,28,38,43),0,180,fill=light,width=2);d.line((24,31,24,43),fill=rim)
 elif level==8:
  for i in range(4):a=TAU*i/4;star(d,24+math.cos(a)*20,24+math.sin(a)*20,2,light)
 elif level==9:d.ellipse((15,31,33,41),outline=light);d.arc((12,32,36,41),0,180,fill=rim,width=1)
 else:d.arc((11,32,26,41),-40,280,fill=light,width=2);d.arc((22,32,37,41),140,460,fill=light,width=2);star(d,24,5,3,light)
 if kind=='enhancement':d.line((6,43,11,38,16,43),fill=light,width=2)
 if kind=='technique':d.polygon([(38,4),(44,4),(44,10)],fill=light)
 return im

for b in DATA['branches']:
 base=OUT/f"power-{b['id']}.png"
 for p in b['powers']:
  save(frame_icon(p['id'],b['color'],p['level'],base=base),f"power-icons/{p['id']}.png",'powerIcons',id=p['id'],name=p['name'],level=p['level'],branchId=b['id'])
for e in DATA['enhancements']:
 b=next(b for b in DATA['branches'] if b['id']==e['branchId'])
 for r in e['ranks']:save(frame_icon(r['id'],b['color'],r['rank']*2,'enhancement',OUT/f"power-{b['id']}.png"),f"enhancement-icons/{r['id']}.png",'enhancementIcons',id=r['id'],name=r['name'],rank=r['rank'])
domain_colors={'Love':'#dba0b0','Light':'#e2c47f','Water':'#8dc5bb','Air':'#9dcad1','Hate':'#c296b7','Dark':'#a899ce','Fire':'#e9a16f','Earth':'#b5bd82'}
for t in DATA['techniques']:
 text=(t['name']+' '+t.get('effect','')).lower();domain=t['domain'];shape='shield' if any(s in text for s in ['barrier','protect','ward']) else 'chain' if any(s in text for s in ['root','slow','interrupt','stasis']) else {'Love':'heart','Light':'sun','Water':'drop','Air':'wind','Hate':'star','Dark':'moon','Fire':'flame','Earth':'leaf'}[domain]
 save(frame_icon(t['id'],domain_colors[domain],t['order']*2,'technique',shape=shape),f"technique-icons/{t['id']}.png",'techniqueIcons',id=t['id'],name=t['name'],lineage=t['lineage'])

for slot in ['focus','ward','utility']:
 for tier in range(1,11):
  color=['#a9b78d','#91b8ad','#a5bdce','#c1b0ca','#d6b77e'][((tier-1)//2)%5];im=frame_icon(f'{slot}-{tier}',color,tier);d=ImageDraw.Draw(im);metal=mix(color,'#ede0ad',.6)
  if slot=='focus':
   d.line((14,36,31,12),fill='#9f8c5d',width=3);d.line((16,35,32,12),fill=metal,width=1);d.polygon([(31,7),(37,15),(30,22),(25,15)],fill=color);d.line((31,9,31,18),fill='#f0e8bf',width=2)
   for j in range(tier//3):star(d,26+j*4,9+j*4,2,metal)
  elif slot=='ward':
   d.arc((10,8,38,36),5,175,fill=metal,width=2);d.polygon([(24,17),(33,27),(29,36),(24,40),(17,34),(15,27)],fill=color);d.polygon([(24,21),(28,27),(24,34),(20,27)],fill=metal)
   if tier>5:d.line((12,17,24,27,37,17),fill=metal,width=1)
  else:
   for x,y in [(12,15),(25,12)]:
    d.polygon([(x,y),(x+8,y),(x+7,y+15),(x+12,y+19),(x+11,y+24),(x-2,y+24),(x-2,y+17)],fill=color);d.line((x-1,y+23,x+11,y+23),fill=metal,width=2);d.line((x+2,y+4,x+7,y+4),fill=metal,width=2)
  save(im,f'equipment-icons/{slot}-{tier}.png','equipment',id=f'{slot}-{tier}',slot=slot,tier=tier,name=f'Rank {tier} {slot}')

def vfx_frame(branch,level,frame):
 im,d=cv(96,96);progress=(frame+.2)/8;rr=9+progress*31;cx=48;cy=51;color=branch['color'];light=mix(color,'#fff4ce',.6);alpha=int(230*(1-progress*.65));col=(*rgb(color),alpha);hi=(*light,alpha);family=branch['id'];rng=random.Random(seed(family)+level*91)
 # Deliberately different readable silhouettes for all sixteen branches.
 if family=='love-laugh':
  d.arc((cx-rr,cy-rr*.5,cx+rr,cy+rr*.5),0,345,fill=col,width=2)
  for i in range(3+level):a=i*TAU/(3+level)+progress;heart(d,cx+math.cos(a)*rr*.8,cy+math.sin(a)*rr*.4-progress*25,3+level*.2,hi)
 elif family=='light-pleasure':
  for i in range(8+level):a=i*TAU/(8+level)+progress*.3;d.line((cx+math.cos(a)*rr*.4,cy+math.sin(a)*rr*.4,cx+math.cos(a)*rr,cy+math.sin(a)*rr),fill=col,width=2)
  star(d,cx,cy-8,8+level*.7,hi)
 elif family=='water-grow':
  for j in range(3):
   rx=max(3,rr-j*4);ry=max(2,rr*.5-j*1.5);d.arc((cx-rx,cy-ry,cx+rx,cy+ry),frame*18,frame*18+270,fill=col,width=2)
  for i in range(4+level):a=i*2.4;drop(d,cx+math.cos(a)*rr*.8,cy+math.sin(a)*rr*.3-progress*23,3,hi)
 elif family=='air-move':
  for j in range(4):d.arc((cx-rr+j*3,cy-rr*.55-j*3,cx+rr-j*3,cy+rr*.55-j*3),frame*30+j*20,frame*30+j*20+195,fill=col,width=2)
  for i in range(3):d.line((cx-rr+i*7,cy-i*10,cx-rr+17+i*7,cy-3-i*10),fill=hi,width=2)
 elif family=='hate-clean':
  d.ellipse((cx-rr,cy-rr*.55,cx+rr,cy+rr*.55),outline=col,width=2);star(d,cx,cy-10,10+level,hi)
  for i in range(5+level):a=i*TAU/(5+level);star(d,cx+math.cos(a)*rr,cy+math.sin(a)*rr*.6,2,hi)
 elif family=='dark-heal':
  for i in range(3):a=progress+i*TAU/3;x=cx+math.cos(a)*rr*.6;y=cy+math.sin(a)*rr*.4-8;d.arc((x-8,y-10,x+8,y+10),45,285,fill=hi,width=3)
  d.ellipse((cx-rr,cy-rr*.5,cx+rr,cy+rr*.5),outline=col,width=2)
 elif family=='fire-create':
  for i in range(5+level):a=i*TAU/(5+level);x=cx+math.cos(a)*rr*.7;y=cy+math.sin(a)*rr*.35;d.polygon([(x-3,y),(x,y-7-progress*10),(x+4,y),(x,y+3)],fill=hi)
 elif family=='earth-give':
  for i in range(6+level):a=i*TAU/(6+level)+progress;xx=cx+math.cos(a)*rr*.8;yy=cy+math.sin(a)*rr*.5;d.polygon([(xx-4,yy+2),(xx-1,yy-6),(xx+5,yy-8),(xx+4,yy),(xx,yy+3)],fill=col)
  d.arc((cx-rr,cy-rr*.5,cx+rr,cy+rr*.5),0,355,fill=hi,width=1)
 elif family=='hate-cry':
  points=[]
  for i in range(30):a=i*TAU/30;r=rr*(1 if i%2 else .82);points.append((cx+math.cos(a)*r,cy+math.sin(a)*r*.6))
  d.polygon(points,outline=col)
  for i in range(5+level):drop(d,cx+(rng.random()-.5)*rr*1.5,18+((i*13+frame*7)%55),3,hi)
 elif family=='dark-pain':
  for i in range(7+level):a=i*TAU/(7+level)+progress*.5;x=cx+math.cos(a)*rr;y=cy+math.sin(a)*rr*.6;d.line((cx+math.cos(a)*9,cy+math.sin(a)*5,x,y-8,x+math.cos(a+.8)*8,y-4),fill=col,width=2)
  d.ellipse((cx-9,cy-6,cx+9,cy+6),outline=hi,width=2)
 elif family=='fire-destroy':
  for i in range(11+level):a=i*TAU/(11+level);r=rr*(.6+rng.random()*.5);x=cx+math.cos(a)*r;y=cy+math.sin(a)*r*.55;d.polygon([(x-3,y),(x+math.cos(a)*9,y+math.sin(a)*7-5),(x+4,y+3)],fill=hi)
  d.ellipse((cx-rr*.5,cy-rr*.25,cx+rr*.5,cy+rr*.25),outline=col,width=3)
 elif family=='earth-take':
  for i in range(6+level):a=i*TAU/(6+level)-progress;r=(1-progress)*34+6;x=cx+math.cos(a)*r;y=cy+math.sin(a)*r*.55;d.polygon([(x-5,y),(x-2,y-7),(x+4,y-6),(x+6,y+1),(x,y+4)],fill=col);d.line((x-2,y-6,x+2,y-6),fill=hi,width=2)
 elif family=='love-dirty':
  for i in range(5+level):a=i*TAU/(5+level)-progress*2;heart(d,cx+math.cos(a)*rr,cy+math.sin(a)*rr*.4-8,3,hi)
  for j in range(3):d.arc((cx-rr+j*4,cy-rr*.6,cx+rr-j*4,cy+rr*.6),frame*40+j*80,frame*40+j*80+100,fill=col,width=2)
 elif family=='light-harm':
  for a in [progress*.1,math.pi/2+progress*.1]:d.line((cx-math.cos(a)*rr,cy-math.sin(a)*rr,cx+math.cos(a)*rr,cy+math.sin(a)*rr),fill=hi,width=2)
  star(d,cx,cy,rr*.65,col);star(d,cx,cy,rr*.24,hi)
 elif family=='water-decay':
  for i in range(7+level):a=i*TAU/(7+level)-progress*2;r=rr*(1-progress*.5);drop(d,cx+math.cos(a)*r,cy+math.sin(a)*r*.45+progress*12,3,col)
  for i in range(12):d.rectangle((int(cx+(rng.random()-.5)*rr*1.7),int(cy+(rng.random()-.5)*rr),int(cx+(rng.random()-.5)*rr*1.7)+1,int(cy+(rng.random()-.5)*rr)+1),fill=hi) if False else None
 else:
  for i in range(8):a=i*TAU/8;xx=cx+math.cos(a)*rr;yy=cy+math.sin(a)*rr*.6;d.line((xx-3,yy,xx+3,yy),fill=hi,width=2);d.line((xx,yy-3,xx,yy+3),fill=hi,width=2)
  d.polygon([(cx,cy-rr*.6),(cx+rr,cy),(cx,cy+rr*.6),(cx-rr,cy)],outline=col);d.line((cx-rr*.5,cy-rr*.3,cx+rr*.5,cy+rr*.3),fill=col);d.line((cx-rr*.5,cy+rr*.3,cx+rr*.5,cy-rr*.3),fill=col)
 return im

for b in DATA['branches']:
 for p in [p for p in b['powers'] if p['kind']=='local']+[{'id':'family-'+b['id'],'level':3}]:
  sheet,_=cv(96*8,96)
  for i in range(8):sheet.alpha_composite(vfx_frame(b,p['level'],i),(96*i,0))
  save(sheet,f"vfx/{p['id']}.png",'vfx',id=p['id'],branchId=b['id'],level=p['level'],frames=8,frameWidth=96,frameHeight=96,fps=12)

def brick(d,box,color,light,dark,unit=15):
 x0,y0,x1,y1=map(int,box);d.rectangle(box,fill=dark)
 for y in range(y0,y1,9):
  for x in range(x0-unit,x1,unit):
   xx=x+(unit//2 if (y-y0)//9%2 else 0);left=max(x0,xx+1);right=min(x1,xx+unit-1)
   if right>left:d.rectangle((left,y+1,right,min(y1,y+7)),fill=color);d.line((left,y+1,right,y+1),fill=light)
def architecture(zone,index):
 name=zone['id'];realm=zone['realm'];desert=any(s in name for s in ['desert','pyramid']);water='waterfall' in name;garden=any(s in name for s in ['garden','grove','forest']);hell=realm=='hell'
 pal=['#3b3046','#705166','#aa7775','#e5b07b'] if hell else ['#755f42','#b69a68','#e4c38a','#f0dca9'] if desert else ['#647d79','#a8b9a4','#d8ddbc','#e9d6a1'] if realm=='heaven' else ['#485e56','#84987b','#bec7a0','#d3c08d']
 dark,base,light,gold=pal;im,d=cv(192,224);r=random.Random(seed(name));d.ellipse((8,193,184,220),fill=(19,34,32,64))
 brick(d,(21,177,171,207),base,light,dark);d.rectangle((17,175,175,181),fill=light)
 if desert and'pyramid' in name:
  d.polygon([(16,173),(96,17),(177,173)],fill=base);d.polygon([(96,17),(177,173),(113,173)],fill=dark)
  for yy in range(42,175,13):width=(yy-17)*.52;d.line((96-width,yy,96+width,yy),fill=light,width=2)
  brick(d,(77,131,113,179),base,light,dark);d.rectangle((85,145,104,179),fill=dark)
 elif'tower' in name or'observator' in name or'knowledge' in name or'librar' in name:
  brick(d,(55,60,137,178),base,light,dark);d.rectangle((48,56,144,65),fill=gold)
  if'observator' in name:d.pieslice((49,6,143,103),180,360,fill=light);d.arc((59,11,133,93),185,355,fill=gold,width=3);d.line((96,17,96,56),fill=gold,width=3)
  else:d.polygon([(43,57),(96,8),(149,57)],fill=dark);d.polygon([(48,53),(96,15),(144,53)],fill=gold)
  for yy in [81,112,144]:
   for xx in [69,102]:d.rectangle((xx,yy,xx+18,yy+21),fill=dark);d.line((xx+9,yy,xx+9,yy+21),fill=gold,width=2);d.line((xx,yy+10,xx+18,yy+10),fill=gold,width=1)
  if'librar' in name or'knowledge' in name:
   d.rectangle((77,22,115,46),fill=light);d.line((96,24,96,46),fill=dark,width=2);d.line((81,28,91,28),fill=gold,width=2);d.line((100,34,111,34),fill=gold,width=2)
 elif'labyrinth' in name:
  for j in range(4):d.rectangle((29+j*16,53+j*22,163-j*16,175),outline=base,width=11)
  for x,y in [(42,94),(151,131),(74,147),(113,80)]:d.rectangle((x,y,x+10,y+22),fill=light)
 elif garden:
  # Mature sacred tree, with an altar and roots anchoring its scale.
  d.polygon([(78,184),(83,99),(70,68),(84,62),(99,103),(110,66),(122,67),(108,116),(115,182)],fill=dark);d.line((95,175,95,89),fill=base,width=5)
  for j,(x,y,rx,ry)in enumerate([(54,80,39,32),(101,49,48,37),(142,78,36,30),(96,99,54,30)]):d.ellipse((x-rx,y-ry,x+rx,y+ry),fill=base);d.ellipse((x-rx+3,y-ry,x+rx-4,y+ry-9),fill=light)
  for j in range(50):x=r.randrange(35,157);y=r.randrange(24,111);d.line((x,y,x+3,y),fill=gold)
  brick(d,(64,161,129,185),base,light,dark);d.ellipse((74,158,119,170),fill=gold)
 elif water:
  d.polygon([(21,167),(22,78),(39,40),(70,25),(124,35),(159,66),(171,169)],fill=dark);d.polygon([(27,79),(41,44),(72,30),(121,41),(151,69),(94,81)],fill=light)
  for x in[43,138]:brick(d,(x,76,x+17,173),base,light,dark)
  d.rectangle((67,75,128,181),fill='#8bc6c2')
  for x in range(70,126,7):d.line((x,79,x-2,175),fill='#d9ecdb',width=2)
  d.ellipse((48,171,147,199),fill='#72aaa1');d.arc((49,174,146,195),0,180,fill='#e1ebd5',width=2)
 else:
  fort=any(s in name for s in ['citadel','stronghold','cities','settlement','conflict','palace'])
  brick(d,(39,89,153,176),base,light,dark)
  for x in[33,139]:
   brick(d,(x,68,x+21,180),base,light,dark)
   if fort:
    d.rectangle((x-3,62,x+25,72),fill=light)
    for xx in range(x-3,x+24,9):d.rectangle((xx,52,xx+5,66),fill=gold)
   else:d.rectangle((x-5,63,x+26,71),fill=gold)
  d.polygon([(27,63),(96,12),(165,63)],fill=dark);d.polygon([(36,59),(96,22),(156,59)],fill=base);d.line((44,57,96,29,149,57),fill=gold,width=3)
  for x in[62,116]:d.rectangle((x,97,x+16,123),fill=dark);d.rectangle((x+3,100,x+13,118),fill=gold)
  d.rectangle((82,126,111,180),fill=dark);d.arc((81,108,113,142),180,360,fill=light,width=4)
  if hell:
   for x in[41,149]:d.polygon([(x-5,66),(x,20),(x+6,66)],fill=gold)
   d.polygon([(88,174),(86,151),(94,158),(98,141),(105,160),(108,175)],fill='#e3a16e')
 # Every named destination has its own crest, geometry and ward markings.
 emblem=(index%7)+3
 for i in range(emblem):a=i*TAU/emblem;star(d,96+math.cos(a)*14,81+math.sin(a)*10,1.5,gold)
 d.line((28,204,165,204),fill=gold,width=2)
 return im,pal

for zi,z in enumerate(DATA['zones']):
 im,pal=architecture(z,zi);save(im,f"zones/{z['id']}-landmark.png",'props',name=z['name'],anchor=[96,208],realm=z['realm'])
 portal,_=cv(96,128)
 for frame in range(6):
  im,d=cv(96,128);dark,base,light,gold=pal;d.ellipse((4,109,92,126),fill=(18,29,35,60));brick(d,(10,106,86,117),base,light,dark,11)
  for x in[17,68]:brick(d,(x,39,x+11,109),base,light,dark,9);d.rectangle((x-3,35,x+14,42),fill=gold)
  d.arc((17,2,79,71),180,360,fill=base,width=12);d.arc((20,8,76,68),180,360,fill=light,width=2)
  glow='#9ac9c0' if z['realm']!='hell' else '#c58b9a';d.ellipse((31,36,65,106),fill=(*mix(glow,'#304b56',.45),230))
  for j in range(3):d.arc((33+j*3,41+j*4,63-j*3,103-j*4),frame*60+j*35,frame*60+j*35+235,fill=glow,width=2)
  star(d,48,77,4,gold)
  for j in range((zi%4)+2):star(d,23+j*16,32-abs(1.5-j)*5,1.5,gold)
  if frame==0:save(im,f"zones/{z['id']}-portal.png",'props',name=z['name']+' gateway',anchor=[48,118],animationSrc=f"/assets/zones/{z['id']}-portal-sheet.png",frames=6,frameWidth=96,frameHeight=128,fps=7)
  if frame==0:sheet,_=cv(576,128)
  sheet.alpha_composite(im,(frame*96,0))
 save(sheet,f"zones/{z['id']}-portal-sheet.png",'characters',frames=6,frameWidth=96,frameHeight=128,fps=7)

# Working NPCs retain readable tools and outfits while their hands animate.
jobs=['guard','medic','scout','trader','blacksmith','farmer','fisher','scholar','bard','gardener','alchemist','courier']
base=Image.open(OUT/'npc.png').convert('RGBA')
for jobindex,job in enumerate(jobs):
 sheet,_=cv(160,48)
 for frame in range(4):
  im,d=cv(40,48);im.alpha_composite(base,(0,7));d=ImageDraw.Draw(im);color=['#88a79d','#b3bd94','#a39ab8','#c2a278'][jobindex%4];d.polygon([(14,25),(26,25),(29,39),(11,39)],fill=color);bob=frame%2
  if job=='guard':d.polygon([(7,27),(15,24),(15,35),(11,40),(6,35)],fill='#b7b18d');d.line((31,19,31,41),fill='#c6c6ab',width=2)
  elif job=='medic':d.rectangle((15,30,25,33),fill='#e1d5b4');d.rectangle((19,26,22,37),fill='#e1d5b4')
  elif job=='scout':d.arc((22,15,36,40),-80,85,fill='#bba87a',width=2);d.line((29,18,29,38),fill='#d8c897');d.polygon([(12,20),(21,9),(28,20)],fill='#5d8271')
  elif job=='blacksmith':d.rectangle((15,26,25,39),fill='#735c4b');d.line((27,29,31,20-bob*4),fill='#a79261',width=2);d.rectangle((27,17-bob*4,35,22-bob*4),fill='#9caf9e')
  elif job in['farmer','gardener']:d.line((30,15,30,42),fill='#b5a176',width=2);d.line((25,14,35,14),fill='#bdc8a4',width=2);d.ellipse((10,16,29,22),fill='#c6b786');d.rectangle((15,12,25,19),fill='#a59568')
  elif job=='fisher':d.line((28,35,33,6),fill='#bfa97b',width=2);d.line((33,6,38,30+bob*4),fill='#d2d3b0');d.polygon([(36,31+bob*4),(39,34+bob*4),(36,37+bob*4),(34,34+bob*4)],fill='#90b9b5')
  elif job=='scholar':d.rectangle((7,28,22,37),fill='#d4cda6');d.line((14,28,14,37),fill='#8e9a7b',width=2);d.rectangle((14,20,18,23),outline='#535f60');d.rectangle((22,20,26,23),outline='#535f60')
  elif job=='bard':d.ellipse((24,29,35,41),fill='#c0a270');d.line((30,31,34,17-bob*2),fill='#d2b982',width=2)
  elif job=='alchemist':d.rectangle((27,27,32,35),fill='#93c2b3');d.rectangle((28,24,31,28),fill='#d6d6b2');d.polygon([(10,20),(20,8),(30,20)],fill='#8f8caa')
  elif job=='courier':d.rectangle((7,30,15,39),fill='#9a8058');d.line((11,29,26,24),fill='#d1bc8f',width=2);d.polygon([(22,17),(31,10),(29,20)],fill='#c8c7a5')
  else:d.rectangle((27,29,35,38),fill='#ac956c');d.line((28,29,29,25,33,25,35,29),fill='#cfbf93')
  sheet.alpha_composite(im,(frame*40,0))
 save(sheet,f'npc-jobs/{job}-sheet.png','characters',job=job,frames=4,frameWidth=40,frameHeight=48,fps=5,anchor=[20,42])

wildlife=['rabbit','songbird','butterfly','frog','fish','snake','bat','owl']
for species in wildlife:
 sheet,_=cv(160,40)
 for frame in range(4):
  im,d=cv(40,40);bob=frame%2;col={'rabbit':'#c7c4a4','songbird':'#a5b5bc','butterfly':'#c6b08a','frog':'#8eac75','fish':'#99c4be','snake':'#8ba97a','bat':'#9a869d','owl':'#b5ad92'}[species]
  if species=='rabbit':d.ellipse((9,20-bob,29,33-bob),fill=col);d.ellipse((22,13-bob,33,26-bob),fill=col);d.rectangle((24,4-bob,27,17-bob),fill=col);d.rectangle((30,6-bob,33,18-bob),fill=col);d.point((30,19-bob),fill='#3b5550');d.ellipse((5,23,13,31),fill='#ded9ba')
  elif species in['songbird','owl']:d.ellipse((11,16-bob,28,31-bob),fill=col);d.polygon([(26,18-bob),(34,21-bob),(27,23-bob)],fill='#d2b989');d.polygon([(13,27),(5,31),(12,19)],fill=col);d.ellipse((16,18,24,27),fill=mix(col,'#536f6d',.3));d.point((25,18-bob),fill='#314f4d')
  elif species in['bat','butterfly']:
   for side in[-1,1]:d.polygon([(20,22),(20+side*(11+bob*5),10),(20+side*16,27),(20,30)],fill=col);d.line((20,23,20+side*12,15),fill='#d4c1b6',width=1)
   d.rectangle((18,15,21,32),fill='#67776e')
  elif species=='frog':d.ellipse((9,19,31,32),fill=col);d.ellipse((11,15,18,23),fill=col);d.ellipse((24,15,31,23),fill=col);d.point((14,18),fill='#3a5f4e');d.point((27,18),fill='#3a5f4e');d.line((13,29,7,34,14,34),fill=col,width=3);d.line((28,29,34,34,27,34),fill=col,width=3)
  elif species=='fish':d.ellipse((8,16+bob,29,28+bob),fill=col);d.polygon([(27,22),(36,14+bob),(36,30-bob)],fill=col);d.point((12,20+bob),fill='#365d61');d.line((16,18,24,18),fill='#d7dfc1')
  else:d.arc((4,14,29,35),0,290,fill=col,width=6);d.ellipse((22,13-bob,34,23-bob),fill=col);d.point((31,16-bob),fill='#3a5e4e')
  sheet.alpha_composite(im,(frame*40,0))
 save(sheet,f'wildlife/{species}-sheet.png','characters',frames=4,frameWidth=40,frameHeight=40,fps=7,anchor=[20,34])

(OUT/'expanded-manifest.json').write_text(json.dumps(M,indent=2))
(OUT/'GENERATED_ART_LICENSE.txt').write_text('ETERNAL POWERS ORIGINAL GENERATED ASSETS\nAll files enumerated in manifest.json and expanded-manifest.json are original project artwork generated by the accompanying Python scripts.\nNo third-party source pixels, recordings, or licensed character artwork were used in these procedural assets.\nThe project owner may use, modify, distribute, and commercialize this original generated artwork under the same terms as the surrounding project.\nFiles in assets/vendor are third-party imports and retain their separate licenses. Parent-generated illustration files are separate generated artworks.\n')
# A small QA sheet shows actual pixels without loading hundreds of icons in chat.
icons=[OUT/v['src'].replace('/assets/','') for group in ['powerIcons','enhancementIcons','techniqueIcons','equipment'] for v in M[group].values()]
contact=Image.new('RGB',(48*20,48*math.ceil(len(icons)/20)),'#1b302d')
for i,p in enumerate(icons):im=Image.open(p);contact.paste(im,((i%20)*48,(i//20)*48),im)
(ROOT/'work').mkdir(exist_ok=True);contact.save(ROOT/'work/expanded-catalog-preview.png')
print(json.dumps({k:len(v) for k,v in M.items() if isinstance(v,dict)},indent=2))

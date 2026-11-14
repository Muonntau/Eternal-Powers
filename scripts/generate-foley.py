"""Original sound design for Eternal Powers. No sample libraries or recordings.

Generates quiet seamless environmental beds, surface footsteps, creature voices,
and a preparation/release/impact sound for each of the sixteen power branches.
Run independently of the artwork/music generators; existing scores are preserved.
"""
from pathlib import Path
import json
import math
import subprocess
import wave
import numpy as np

OUT = Path(__file__).resolve().parents[1] / 'public' / 'assets' / 'audio'
OUT.mkdir(parents=True, exist_ok=True)
SR = 22050
RNG = np.random.default_rng(17633)
MANIFEST = {'license': 'Original synthesized project sound design; no third-party samples',
            'sampleRate': SR, 'ambience': [], 'footsteps': [], 'creatures': [], 'spells': []}


def wav(name, signal, category):
    signal = np.asarray(signal)
    signal -= np.mean(signal, axis=0)
    peak = np.max(np.abs(signal))
    if peak > .78:
        signal *= .78 / peak
    with wave.open(str(OUT / f'{name}.wav'), 'wb') as file:
        file.setnchannels(1 if signal.ndim == 1 else signal.shape[1])
        file.setsampwidth(2)
        file.setframerate(SR)
        file.writeframes((np.clip(signal, -1, 1) * 32767).astype('<i2').tobytes())
    MANIFEST[category].append({'id': name, 'duration': len(signal) / SR})


def smooth_noise(n, width=12):
    noise = RNG.normal(0, 1, n)
    return np.convolve(noise, np.ones(width) / math.sqrt(width), mode='same')


def sweep(t, start, end):
    duration = max(t[-1], .001)
    return np.sin(2 * np.pi * (start * t + (end - start) * t * t / (2 * duration)))


def bell(t, hz, decay=6):
    return (np.sin(2*np.pi*hz*t) + .20*np.sin(2*np.pi*hz*2.003*t)
            + .07*np.sin(2*np.pi*hz*3.97*t)) * np.exp(-decay*t)


def soft_envelope(t, duration):
    return np.minimum(t / .018, 1) * np.minimum((duration - t) / .11, 1)


# Small, close-miked sounding footsteps, with no harsh transients.
for material in ['grass', 'stone', 'sand', 'water']:
    duration = .26 if material == 'water' else .21
    t = np.arange(int(duration * SR)) / SR
    thud = sweep(t, 95, 38) * np.exp(-42*t)
    if material == 'grass':
        signal = .22*thud + .095*smooth_noise(len(t), 9)*np.exp(-27*t)
    elif material == 'stone':
        signal = .17*thud + .095*bell(t, 710, 42) + .05*smooth_noise(len(t), 2)*np.exp(-85*t)
    elif material == 'sand':
        signal = .15*thud + .12*smooth_noise(len(t), 15)*np.exp(-25*t)
        signal += .035*smooth_noise(len(t), 3)*np.exp(-11*t)*np.sin(np.pi*t/duration)
    else:
        signal = .18*sweep(t, 480, 100)*np.exp(-23*t)
        signal += .095*smooth_noise(len(t), 7)*np.exp(-15*t)
        signal += .045*np.sin(2*np.pi*(900*t-900*t*t))*np.exp(-30*t)
    wav(f'footstep-{material}', signal*soft_envelope(t, duration), 'footsteps')


# Six vocal families shared by related creatures, distinct from their attacks.
for family in ['deer', 'chirp', 'wisp', 'growl', 'demon', 'golem']:
    duration = {'deer':.58, 'chirp':.44, 'wisp':.94, 'growl':.86, 'demon':1.06, 'golem':1.15}[family]
    t = np.arange(int(duration*SR))/SR
    if family == 'deer':
        phase = 2*np.pi*(330*t - 100*t*t) + .3*np.sin(2*np.pi*17*t)
        signal = (np.sin(phase)+.25*np.sin(phase*2))*.15*np.sin(np.pi*t/duration)**1.7
    elif family == 'chirp':
        signal = .11*sweep(t, 1700, 2700)*np.sin(np.pi*t/duration)**3
        signal += .05*np.sin(2*np.pi*(2400*t-1200*t*t))*np.exp(-((t-.29)/.055)**2)
    elif family == 'wisp':
        signal = (sweep(t, 660, 900)*.10 + sweep(t, 990, 1350)*.055)*np.sin(np.pi*t/duration)**2
        signal += smooth_noise(len(t), 40)*.012*np.sin(np.pi*t/duration)
    elif family == 'growl':
        phase = 2*np.pi*(105*t-22*t*t)
        signal = sum(np.sin(phase*k)/k for k in range(1,8))*.13
        signal *= (.7+.3*np.sin(2*np.pi*24*t))*np.sin(np.pi*t/duration)**1.5
        signal += smooth_noise(len(t), 11)*.04*np.sin(np.pi*t/duration)**2
    elif family == 'demon':
        phase = 2*np.pi*(79*t+18*t*t)+.6*np.sin(2*np.pi*13*t)
        signal = (np.sin(phase)+.4*np.sin(phase*3)+.12*np.sin(phase*7))*.16
        signal += sweep(t, 480, 245)*.04
        signal *= np.sin(np.pi*t/duration)**1.4
    else:
        signal = (np.sin(2*np.pi*52*t)+.32*np.sin(2*np.pi*83*t))*.13
        signal += smooth_noise(len(t), 36)*.075 + bell(t, 240, 4)*.045
        signal *= np.sin(np.pi*t/duration)**1.5
    wav(f'creature-{family}', signal*soft_envelope(t,duration), 'creatures')


# Power identity lives in both pitch and texture; stage envelopes communicate
# preparation, commitment and target impact separately. Level variation is a
# small runtime pitch/potency change, rather than many duplicate recordings.
BRANCHES = [
    ('love-laugh', 392, 'joy'), ('light-pleasure', 587, 'glow'),
    ('water-grow', 440, 'water'), ('air-move', 740, 'wind'),
    ('hate-clean', 523, 'clean'), ('dark-heal', 220, 'heal'),
    ('fire-create', 330, 'forge'), ('earth-give', 262, 'earth'),
    ('hate-cry', 196, 'cry'), ('dark-pain', 146, 'pain'),
    ('fire-destroy', 110, 'flame'), ('earth-take', 165, 'gravel'),
    ('love-dirty', 349, 'trick'), ('light-harm', 880, 'glare'),
    ('water-decay', 247, 'decay'), ('air-stop', 466, 'vacuum'),
]
for branch, hz, texture in BRANCHES:
    for stage, duration in [('cast', .58), ('release', .88), ('hit', .36)]:
        t = np.arange(int(duration*SR))/SR
        rise = stage == 'cast'
        pitch = .82 if rise else 1.08 if stage == 'hit' else 1
        f = hz*pitch
        noise = smooth_noise(len(t), 9)
        if texture == 'joy':
            signal = .16*bell(t,f,3) + .09*bell(np.maximum(t-.11,0),f*1.25,5)*(t>.11)
            signal += .06*bell(np.maximum(t-.22,0),f*1.5,6)*(t>.22)
        elif texture == 'glow':
            signal = .13*bell(t,f,2.5)+.065*bell(t,f*1.5,3.5)+.04*bell(t,f*2,4)
        elif texture == 'water':
            signal = .16*sweep(t,f*2.5,f*.62)*np.exp(-12*t)+noise*.045*np.exp(-4*t)
            signal += .09*bell(t,f,4)
        elif texture == 'wind':
            signal = smooth_noise(len(t),18)*.12*np.sin(np.pi*t/duration)
            signal += .055*sweep(t,f*.55,f*1.8)*np.sin(np.pi*t/duration)**2
        elif texture == 'clean':
            signal = .14*bell(t,f,5)+.07*bell(t,f*2.25,7)+noise*.04*np.exp(-16*t)
        elif texture == 'heal':
            signal = (np.sin(2*np.pi*f*t)+.35*np.sin(2*np.pi*f*1.5*t))*.13*np.sin(np.pi*t/duration)**1.5
            signal += .055*bell(t,f*4,5)
        elif texture == 'forge':
            signal = .14*bell(t,f,4)+.055*bell(t,f*2.73,6)
            signal += smooth_noise(len(t),3)*.04*np.exp(-7*t)*(.5+.5*np.sin(2*np.pi*37*t))
        elif texture == 'earth':
            signal = .20*sweep(t,150,70)*np.exp(-10*t)+.10*bell(t,f,6)
            signal += .045*bell(t,f*1.5,6)
        elif texture == 'cry':
            phase=2*np.pi*(f*1.8*t-f*.5*t*t)+.1*np.sin(2*np.pi*8*t)
            signal=(np.sin(phase)+.27*np.sin(phase*3))*.13*np.sin(np.pi*t/duration)
        elif texture == 'pain':
            signal=(np.sin(2*np.pi*f*t)+.3*np.sin(2*np.pi*f*1.06*t)+.15*np.sin(2*np.pi*f*3*t))*.14
            signal*=np.exp(-3*t)*(.7+.3*np.sin(2*np.pi*18*t))
        elif texture == 'flame':
            signal = .18*sweep(t,f*1.8,f*.5)*np.exp(-5*t)
            signal += smooth_noise(len(t),3)*.11*np.exp(-5*t)*(.65+.35*np.sin(2*np.pi*47*t))
        elif texture == 'gravel':
            signal = smooth_noise(len(t),14)*.14*np.exp(-6*t)
            signal += .18*sweep(t,f,40)*np.exp(-9*t)+.05*bell(t,f*2.8,11)
        elif texture == 'trick':
            signal=.12*sweep(t,f,f*.64)*np.exp(-3*t)+.08*bell(t,f*1.06,5)
            signal+=noise*.03*np.exp(-8*t)
        elif texture == 'glare':
            signal=.11*bell(t,f,6)+.07*bell(t,f*1.414,7)+.04*bell(t,f*2.62,9)
            signal+=noise*.03*np.exp(-25*t)
        elif texture == 'decay':
            signal=.16*sweep(t,f*2,f*.35)*np.exp(-8*t)+smooth_noise(len(t),22)*.07*np.exp(-4*t)
            signal+=.045*np.sin(2*np.pi*f*.5*t)*np.exp(-5*t)
        else:
            signal=smooth_noise(len(t),22)*.13*np.sin(np.pi*t/duration)**.7
            signal+=.10*sweep(t,f*1.7,f*.25)*np.exp(-5*t)
        if stage == 'cast':
            signal *= (.22 + .64*np.minimum(t/(duration*.75),1))*np.minimum((duration-t)/.10,1)
            signal += .026*sweep(t,f*.5,f)*np.sin(np.pi*t/duration)
        elif stage == 'hit':
            signal *= np.exp(-6*t)*1.1
            signal += noise*.022*np.exp(-28*t)
        else:
            # One short echo gives releases space without masking the next cue.
            shifted = np.zeros(len(t));n=int(.13*SR);shifted[n:]=signal[:-n]*.22
            signal += shifted
        wav(f'spell-{branch}-{stage}', signal*soft_envelope(t,duration), 'spells')


# Environmental beds are circularly assembled and only play after audio unlock.
for name in ['forest', 'forest-night', 'water', 'wind', 'infernal', 'rain']:
    duration = 12
    size = duration*SR
    t = np.arange(size)/SR
    spectrum = np.zeros(size//2+1, dtype=np.complex128)
    bands = {'forest':(150,3100),'forest-night':(300,5000),'water':(80,4500),
             'wind':(30,1500),'infernal':(18,800),'rain':(300,7500)}
    low, high = bands[name]
    bins = np.arange(int(low*duration),int(high*duration),3)
    spectrum[bins] = (RNG.normal(size=len(bins))+1j*RNG.normal(size=len(bins)))/np.sqrt(np.maximum(bins,1))
    noise = np.fft.irfft(spectrum,n=size)
    noise /= np.sqrt(np.mean(noise*noise))+.00001
    signal = np.zeros((size,2))
    bed = noise*.018*(.6+.25*np.sin(2*np.pi*t/duration)+.15*np.sin(6*np.pi*t/duration))
    signal[:,0] += bed;signal[:,1] += np.roll(bed,291)

    def place(data, second, pan=0):
        ix=(np.arange(len(data))+int(second*SR))%size
        signal[ix,0]+=data*math.sqrt((1-pan)/2)
        signal[ix,1]+=data*math.sqrt((1+pan)/2)

    if name == 'forest':
        for second in [.8,3.5,7.8,10.5]:
            chirpt=np.arange(int(.22*SR))/SR
            data=sweep(chirpt,1850+second*20,2800)*np.sin(np.pi*chirpt/.22)**3*.027
            place(data,second,math.sin(second)*.7);place(data*.65,second+.29,-.2)
    elif name == 'forest-night':
        for second in np.arange(.3,12,.73):
            chirpt=np.arange(int(.12*SR))/SR
            data=np.sin(2*np.pi*3400*chirpt)*np.sin(np.pi*chirpt/.12)**2*.017
            place(data,float(second),math.sin(second*2)*.6)
    elif name == 'water':
        for second in RNG.uniform(0,12,33):
            dt=np.arange(int(.19*SR))/SR
            place(sweep(dt,RNG.uniform(600,1600),RNG.uniform(160,400))*np.exp(-25*dt)*.035,float(second),float(RNG.uniform(-.6,.6)))
    elif name == 'infernal':
        signal[:,0]+=np.sin(2*np.pi*42*t)*.014*(.7+.3*np.sin(2*np.pi*t/12))
        signal[:,1]+=np.sin(2*np.pi*42*t+.2)*.014*(.7+.3*np.sin(2*np.pi*t/12))
        for second in RNG.uniform(0,12,28):
            dt=np.arange(int(.07*SR))/SR
            place(RNG.normal(size=len(dt))*np.exp(-80*dt)*.027,float(second),float(RNG.uniform(-.7,.7)))
    elif name == 'rain':
        for second in RNG.uniform(0,12,95):
            dt=np.arange(int(.035*SR))/SR
            place(sweep(dt,RNG.uniform(1200,2000),500)*np.exp(-150*dt)*.015,float(second),float(RNG.uniform(-1,1)))
    signal-=np.mean(signal,axis=0)
    peak=np.max(np.abs(signal))
    if peak>.24:signal*=.24/peak
    tmp=OUT/f'ambient-{name}.wav'
    with wave.open(str(tmp),'wb')as file:
        file.setnchannels(2);file.setsampwidth(2);file.setframerate(SR)
        file.writeframes((np.clip(signal,-1,1)*32767).astype('<i2').tobytes())
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(tmp),'-c:a','libvorbis','-q:a','3',str(OUT/f'ambient-{name}.ogg')],check=True)
    tmp.unlink()
    MANIFEST['ambience'].append({'id':f'ambient-{name}','duration':duration})

(OUT/'foley-manifest.json').write_text(json.dumps(MANIFEST,indent=2)+'\n')
(OUT/'FOLEY.txt').write_text('Original Eternal Powers environmental and action sound design.\n'
    'Six seamless stereo ambience loops; grass/stone/sand/water footsteps; six creature voice families;\n'
    'sixteen distinct power branches with preparation, release, and impact cues.\n'
    'All synthesized by scripts/generate-foley.py; no third-party samples or recordings.\n')
print('Generated',sum(len(MANIFEST[k])for k in ['ambience','footsteps','creatures','spells']),'original environmental/action sounds.')

"""Compose the four original Eternal Powers regional scores.

Each is a 24-second, 32-beat seamless stereo loop at 80 BPM. Notes and pad
envelopes are placed circularly, and the soft atmospheric bed is periodic.
Only project-local recordings are generated; no samples are imported.
"""
from pathlib import Path
import json
import math
import subprocess
import wave
import numpy as np

OUT = Path(__file__).resolve().parents[1] / 'public' / 'assets' / 'audio'
OUT.mkdir(parents=True, exist_ok=True)
SR, BPM, BEATS = 22050, 80, 32
BEAT = 60 / BPM
LENGTH = int(BEATS * BEAT * SR)


def frequency(note):
    return 440 * 2 ** ((note - 69) / 12)


def bell(note, duration=3, amplitude=.13, metallic=False):
    t = np.arange(int(duration * SR)) / SR
    f = frequency(note)
    harmonics = [(1, 1, 1.4), (2.002, .20, 2.1), (3.99, .065, 3.4)]
    if metallic:
        harmonics = [(1, 1, 1.8), (2.71, .23, 2.5), (5.03, .07, 4)]
    signal = sum(a * np.sin(2 * np.pi * f * ratio * t) * np.exp(-decay * t)
                 for ratio, a, decay in harmonics)
    return signal * amplitude * (1 - np.exp(-70 * t))


def pluck(note, duration=1.8, amplitude=.12):
    t = np.arange(int(duration * SR)) / SR
    f = frequency(note)
    signal = sum(np.sin(2 * np.pi * f * n * t) * np.exp(-(2.3 + n * .8) * t) / n
                 for n in range(1, 7))
    return signal * amplitude * (1 - np.exp(-160 * t))


def flute(note, duration=2, amplitude=.10):
    t = np.arange(int(duration * SR)) / SR
    f = frequency(note)
    env = np.minimum(t / .23, 1) * np.minimum((duration - t) / .6, 1)
    phase = 2 * np.pi * f * t + .025 * np.sin(2 * np.pi * 4.8 * t)
    return amplitude * env * (np.sin(phase) + .12 * np.sin(phase * 2))


def pad(note, duration=8, amplitude=.025, choir=False, dark=False):
    t = np.arange(int(duration * SR)) / SR
    f = frequency(note)
    attack = 1.8 if choir else 1.2
    env = np.minimum(t / attack, 1) * np.minimum((duration - t) / 2.2, 1)
    base = (np.sin(2 * np.pi * f * t)
            + .18 * np.sin(2 * np.pi * f * 2 * t)
            + .08 * np.sin(2 * np.pi * f * 3 * t))
    if choir:
        # Gentle higher formants suggest a wordless choir without speech.
        base += .12 * np.sin(2 * np.pi * f * 4 * t) + .06 * np.sin(2 * np.pi * f * 6 * t)
    if dark:
        base = np.tanh(base * 1.3) + .15 * np.sin(2 * np.pi * f * .5 * t)
    return base * amplitude * env * (.93 + .07 * np.sin(2 * np.pi * .21 * t))


def save_score(name, title, chords, melody, mood):
    score = np.zeros((LENGTH, 2), dtype=np.float64)
    rng = np.random.default_rng(sum(map(ord, name)) + 601)

    def place(data, beat, pan=0):
        indices = (np.arange(len(data)) + round(beat * BEAT * SR)) % LENGTH
        score[indices, 0] += data * math.sqrt((1 - pan) / 2)
        score[indices, 1] += data * math.sqrt((1 + pan) / 2)

    # Long overlapping pads continue across the end of the loop.
    for bar, chord in enumerate(chords):
        for voice, note in enumerate(chord):
            place(pad(note, 10 * BEAT, .026 if mood != 'hell' else .034,
                      choir=mood == 'heaven', dark=mood == 'hell'),
                  bar * 8 - 1.5, (voice - 1.5) * .22)

    for i, (beat, note, duration) in enumerate(melody):
        pan = math.sin(i * 1.8) * .38
        if mood == 'desert':
            data = pluck(note, duration, .15)
        elif mood == 'water':
            data = flute(note, duration, .105) if i % 3 == 0 else bell(note, duration, .10)
        elif mood == 'hell':
            data = bell(note, duration, .072, metallic=True)
        else:
            data = bell(note, duration, .12)
        place(data, beat, pan)
        place(data * .22, beat + .37, -pan)
        place(data * .085, beat + .74, pan * .4)

    if mood == 'heaven':
        # Quiet ascending harp figures float around the broad choir chords.
        for b in range(0, 32, 4):
            chord = chords[b // 8]
            for j in range(3):
                place(pluck(chord[j] + 24, 2.4, .044), b + j * .5, (j - 1) * .48)
    elif mood == 'hell':
        # Low heartbeat, distant bowed-metal ticks, slow suspended tension.
        for b in range(0, 32, 2):
            t = np.arange(int(.38 * SR)) / SR
            pulse = np.sin(2 * np.pi * (62 * t - 30 * t * t)) * np.exp(-15 * t) * .10
            place(pulse, b, 0)
            if b % 8 == 4:
                place(bell(42, 3, .035, metallic=True), b + 1, -.3)
    elif mood == 'desert':
        # A restrained frame-drum pattern and reed answer to the plucked lead.
        for b in range(0, 32, 2):
            t = np.arange(int(.23 * SR)) / SR
            drum = np.sin(2 * np.pi * (110 * t - 90 * t * t)) * np.exp(-24 * t) * .055
            place(drum, b, -.15)
            click = rng.normal(0, 1, int(.06 * SR)) * np.exp(-np.arange(int(.06 * SR)) / SR * 100) * .023
            place(click, b + 1.25, .35)
        for b, note in [(6, 74), (14, 77), (22, 74), (29, 69)]:
            place(flute(note, 2.1, .050), b, -.35)
    else:
        # Falling little water bells never compete with the lead.
        for b in range(1, 32, 4):
            for j, note in enumerate([88, 83, 79]):
                place(bell(note, 1.8, .025), b + j * .25, .5 - j * .4)

    # Periodic atmospheric texture is quiet and has no seam or DC offset.
    spectrum = np.zeros(LENGTH // 2 + 1, dtype=np.complex128)
    bins = np.arange(40 if mood == 'hell' else 200, 7000, 9)
    spectrum[bins] = rng.normal(0, 1, len(bins)) + 1j * rng.normal(0, 1, len(bins))
    wind = np.fft.irfft(spectrum, n=LENGTH)
    wind /= max(np.max(np.abs(wind)), .001)
    wind *= .0035 if mood != 'water' else .008
    score[:, 0] += wind
    score[:, 1] += np.roll(wind, 260)
    score -= np.mean(score, axis=0)
    score = np.tanh(score * 1.28) * .82
    peak = float(np.max(np.abs(score)))
    if peak > .72:
        score *= .72 / peak
    wav_path = OUT / f'{name}.wav'
    with wave.open(str(wav_path), 'wb') as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(SR)
        output.writeframes((np.clip(score, -1, 1) * 32767).astype('<i2').tobytes())
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav_path),
                    '-c:a', 'libvorbis', '-q:a', '4', str(OUT / f'{name}.ogg')], check=True)
    wav_path.unlink()
    return {'id': name, 'title': title, 'duration': BEATS * BEAT, 'bpm': BPM,
            'license': 'Original project composition; no external samples', 'mood': mood}


tracks = [
    save_score('heaven', 'The Unclouded Halls',
               [[53, 60, 64, 71], [57, 64, 67, 72], [55, 62, 65, 69], [60, 64, 67, 74]],
               [(0, 77, 4), (2.5, 81, 3.5), (5, 83, 4), (8, 84, 4), (11, 79, 3),
                (14, 76, 3), (16, 77, 4), (19, 81, 4), (22, 86, 4), (25, 84, 4), (29, 79, 4)],
               'heaven'),
    save_score('hell', 'Beneath the Ember Vault',
               [[40, 47, 53, 59], [41, 48, 52, 59], [45, 52, 55, 60], [40, 47, 50, 53]],
               [(1, 64, 4.8), (5, 65, 4), (9, 59, 5), (13, 64, 4), (17, 60, 4),
                (21, 59, 4), (25, 65, 4), (29, 64, 5)],
               'hell'),
    save_score('desert', 'Stars Above the Dunes',
               [[50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64], [45, 52, 57, 61]],
               [(0, 74, 2), (1, 77, 2), (2.5, 81, 2), (4, 77, 2), (5, 74, 2),
                (8, 70, 2), (9.5, 74, 2), (11, 77, 2), (12.5, 74, 2), (16, 72, 2),
                (17, 76, 2), (19, 79, 2), (20.5, 76, 2), (24, 69, 2), (25, 73, 2),
                (26.5, 76, 2), (28, 73, 2), (30, 69, 2)],
               'desert'),
    save_score('water', 'Prismatic Tides',
               [[48, 55, 59, 64], [45, 52, 55, 62], [53, 60, 64, 69], [55, 62, 65, 69]],
               [(0, 76, 3.2), (2, 79, 3), (4, 83, 3), (6, 79, 3), (8, 74, 3.2),
                (10, 76, 3), (12, 79, 3), (14, 74, 3), (16, 77, 3.2), (18, 81, 3),
                (20, 84, 3), (22, 81, 3), (24, 79, 3.2), (26, 77, 3), (28, 74, 3), (30, 72, 3)],
               'water'),
]
(OUT / 'music-manifest.json').write_text(json.dumps(tracks, indent=2) + '\n')
(OUT / 'BIOME_MUSIC.txt').write_text(
    'Original Eternal Powers regional scores\n'
    + '\n'.join(f"{track['title']}: {track['id']}.ogg, 24-second seamless stereo loop, 80 BPM."
                for track in tracks)
    + '\n\nComposed and synthesized by scripts/generate-biome-audio.py.\n'
      'No third-party recordings, melodies, or sample libraries.\n')
print('Generated four original 24-second regional music loops in', OUT)

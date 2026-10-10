"""Writes the Play Zone background tunes (assets/music/loop-*.mp3).

Original, synthesized music: a soft marimba-like melody over gentle chords,
made from sine waves here, so there are no recordings or licences involved.
Each tune is a seamless loop. Needs numpy and ffmpeg:  python3 scripts/generate_game_music.py
"""
import subprocess, wave
from pathlib import Path
import numpy as np

RATE = 22050
OUT = Path(__file__).resolve().parents[1] / 'assets' / 'music'
OUT.mkdir(parents=True, exist_ok=True)
NOTE = {n: 440 * 2 ** ((i - 9) / 12) for i, n in enumerate(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])}

def freq(name):  # 'E5', 'G4'
    return NOTE[name[:-1]] * 2 ** (int(name[-1]) - 4)

def mallet(f, seconds, loud=1.0):
    t = np.arange(int(RATE * seconds)) / RATE
    env = np.minimum(1, t / 0.006) * np.exp(-t * 5.5)
    return loud * env * (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t * 18))

def pad(fs, seconds, loud=0.18):
    t = np.arange(int(RATE * seconds)) / RATE
    env = np.minimum(1, t / 0.25) * np.minimum(1, (seconds - t) / 0.25)
    return loud * env * sum(np.sin(2 * np.pi * f * t) * 0.6 + 0.2 * np.sin(2 * np.pi * 2 * f * t) for f in fs) / len(fs)

def song(name, bpm, chords, melody, seed):
    beat = 60 / bpm
    bars = len(chords)
    total = int(RATE * beat * 4 * bars)
    mix = np.zeros(total + RATE * 2)
    rng = np.random.default_rng(seed)
    for b, chord in enumerate(chords):
        start = int(RATE * beat * 4 * b)
        p = pad([freq(n) for n in chord], beat * 4)
        mix[start:start + len(p)] += p
        root = freq(chord[0]) / 2
        for k in (0, 2):  # soft bass on beats 1 and 3
            s = start + int(RATE * beat * k)
            m = mallet(root, beat * 1.5, 0.35)
            mix[s:s + len(m)] += m
        for k in range(8):  # quiet shaker on the off-beats
            if k % 2:
                s = start + int(RATE * beat * k / 2)
                n = int(RATE * 0.05)
                mix[s:s + n] += rng.uniform(-1, 1, n) * np.exp(-np.arange(n) / (RATE * 0.012)) * 0.04
    t = 0.0
    for note, length in melody:
        s = int(RATE * beat * t)
        if note != '-':
            m = mallet(freq(note), beat * max(length, 1) + 0.4, 0.5)
            mix[s:s + len(m)] += m
        t += length
    # Wrap the tail into the start so the loop is seamless.
    tail = mix[total:]
    mix = mix[:total]
    mix[:len(tail)] += tail
    mix = mix / np.max(np.abs(mix)) * 0.6
    wav = OUT / f'{name}.wav'
    with wave.open(str(wav), 'wb') as w:
        w.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
        w.writeframes((mix * 32767).astype('<i2').tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), '-b:a', '64k', str(OUT / f'{name}.mp3')], check=True)
    wav.unlink()

# A bouncy tune for the games (C major, I–vi–IV–V twice).
song('loop-playful', 112,
     [['C4', 'E4', 'G4'], ['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4']] * 2,
     [('E5', .5), ('G5', .5), ('C6', 1), ('G5', .5), ('E5', .5), ('D5', 1),
      ('C5', .5), ('E5', .5), ('A5', 1), ('G5', 1), ('E5', 1),
      ('F5', .5), ('A5', .5), ('C6', 1), ('A5', .5), ('F5', .5), ('E5', 1),
      ('D5', .5), ('G5', .5), ('B5', 1), ('A5', .5), ('G5', .5), ('-', 1),
      ('E5', .5), ('G5', .5), ('C6', 1), ('D6', .5), ('C6', .5), ('G5', 1),
      ('A5', .5), ('G5', .5), ('E5', 1), ('C5', 1), ('E5', 1),
      ('F5', 1), ('A5', .5), ('G5', .5), ('F5', 1), ('E5', 1),
      ('D5', .5), ('E5', .5), ('G5', 1), ('C6', 1.5), ('-', .5)],
     seed=7)

# A calmer tune for drawing and puzzles (F major, slower).
song('loop-calm', 88,
     [['F3', 'A3', 'C4'], ['D3', 'F3', 'A3'], ['A#3', 'D4', 'F4'], ['C4', 'E4', 'G4']] * 2,
     [('A4', 1), ('C5', 1), ('F5', 2),
      ('D5', 1), ('F5', 1), ('A5', 2),
      ('A#4', 1), ('D5', 1), ('F5', 1), ('D5', 1),
      ('C5', 1), ('E5', 1), ('G5', 2),
      ('F5', 1), ('A5', 1), ('C6', 2),
      ('A5', 1), ('F5', 1), ('D5', 2),
      ('D5', 1), ('F5', 1), ('A#5', 1), ('A5', 1),
      ('G5', 2), ('E5', 1), ('-', 1)],
     seed=11)
print('wrote', sorted(p.name for p in OUT.glob('loop-*.mp3')))

// Looping theme music, synthesised live with Web Audio like the sound effects (no audio files):
// a title theme, a battle theme and one theme per Story chapter.
// It plays through the sound effects' audio graph (`arenaSound.output`) on a bus of its own,
// so music has its own volume and mute, saved in localStorage under `npc-arena-music`.
import { arenaSound } from "./arena-sound";

export type MusicTheme = "title" | "battle" | `chapter${number}`;
export type MusicPrefs = { volume: number; muted: boolean };

const STORE = "npc-arena-music";
const STEPS = 16; // sixteenth notes per bar

type Hit = { step: number; midi: number; len: number }; // len in steps

type SongDef = {
  bpm: number;
  /** One chord per bar, note names low to high. */
  pad: string[];
  padWave: OscillatorType;
  padCut: number;
  padAttack: number;
  /** One root per bar; the pattern marks x = root, o = octave up, . = rest. */
  bass: string[];
  bassPat: string;
  bassMax: number;
  bassCut: number;
  /** One bar per string, eight eighth-note tokens: a note, - to hold, . to rest. */
  lead: string[];
  leadWave: OscillatorType;
  leadVol: number;
  /** Chord-tone arpeggio, one character per step: 0-2 a chord note, 3 the root an octave up. */
  arp: string | null;
  kick: string;
  snare: string;
  hat: string;
  /** The last bar's drums, a fill into the loop. */
  fill: { kick: string; snare: string };
  drums: number;
};

type Song = Omit<SongDef, "pad" | "bass" | "lead"> & { pad: number[][]; bass: number[]; lead: Hit[][] };

const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midi(name: string): number {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  return 12 * (Number(m[3]) + 1) + SEMI[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function song(d: SongDef): Song {
  const lead = d.lead.map((bar) => {
    const hits: Hit[] = [];
    bar.trim().split(/\s+/).forEach((tok, i) => {
      if (tok === ".") return;
      if (tok === "-") {
        const last = hits[hits.length - 1];
        if (last) last.len += 2;
        return;
      }
      hits.push({ step: i * 2, midi: midi(tok), len: 2 });
    });
    return hits;
  });
  return { ...d, pad: d.pad.map((c) => c.split(" ").map(midi)), bass: d.bass.map(midi), lead };
}

const SONGS: Record<"title" | "battle", Song> = {
  // Title: a slow, wide D minor theme with a rolling arpeggio, built to sit behind the mode cards.
  title: song({
    bpm: 96,
    pad: ["D3 F3 A3", "Bb2 D3 F3", "F3 A3 C4", "C3 E3 G3", "D3 F3 A3", "Bb2 D3 F3", "C3 E3 G3", "A2 C#3 E3"],
    padWave: "sawtooth",
    padCut: 900,
    padAttack: 0.7,
    bass: ["D2", "Bb1", "F2", "C2", "D2", "Bb1", "C2", "A1"],
    bassPat: "x.......x...x...",
    bassMax: 8,
    bassCut: 420,
    lead: [
      "D5 - - - F5 - A5 -",
      "G5 - F5 - D5 - - -",
      "C5 - - - F5 - A5 -",
      "G5 - - - E5 - - -",
      "A5 - - - G5 F5 E5 F5",
      "D5 - - - F5 - Bb5 -",
      "A5 - G5 - E5 - C5 -",
      "C#5 - - - E5 - - -",
    ],
    leadWave: "triangle",
    leadVol: 0.12,
    arp: "0123012301230123",
    kick: "x.......x.....x.",
    snare: "....x.......x...",
    hat: "..x...x...x...x.",
    fill: { kick: "x.......x.......", snare: "....x.......x.xx" },
    drums: 0.6,
  }),
  // Battle: a driving A minor theme with a pumping bass line and a square-wave lead.
  battle: song({
    bpm: 148,
    pad: ["A3 C4 E4", "F3 A3 C4", "G3 B3 D4", "E3 G#3 B3", "A3 C4 E4", "F3 A3 C4", "G3 B3 D4", "E3 G#3 B3"],
    padWave: "sawtooth",
    padCut: 1100,
    padAttack: 0.08,
    bass: ["A1", "F1", "G1", "E1", "A1", "F1", "G1", "E1"],
    bassPat: "x.xox.x.x.xox.x.",
    bassMax: 2,
    bassCut: 650,
    lead: [
      "A4 . C5 E5 - D5 C5 B4",
      "C5 - A4 . F4 . A4 C5",
      "D5 - B4 . G4 . D5 E5",
      "E5 - - G#4 B4 - E5 .",
      "A5 - G5 E5 - C5 D5 E5",
      "F5 - E5 C5 - A4 C5 F5",
      "G5 - F5 D5 - B4 D5 G5",
      "G#5 - E5 - B4 - G#4 .",
    ],
    leadWave: "square",
    leadVol: 0.06,
    arp: null,
    kick: "x.....x.x.x...x.",
    snare: "....x.......x...",
    hat: "x.x.x.x.x.x.x.o.",
    fill: { kick: "x.....x.x.......", snare: "....x...x.x.xxxx" },
    drums: 1,
  }),
};

/** One theme per Story chapter, played on the chapter's map and in its fights. Each fits its boss. */
const CHAPTER_SONGS: Song[] = [
  // 1. Nullshade: an eerie E Phrygian pulse, hollow and cold like the rift.
  song({
    bpm: 124,
    pad: ["E3 G3 B3", "F3 A3 C4", "E3 G3 B3", "D3 F#3 A3", "C3 E3 G3", "F3 A3 C4", "D3 F#3 A3", "B2 D#3 F#3"],
    padWave: "sawtooth",
    padCut: 760,
    padAttack: 0.5,
    bass: ["E2", "F2", "E2", "D2", "C2", "F2", "D2", "B1"],
    bassPat: "x..x..x.x..x..x.",
    bassMax: 3,
    bassCut: 500,
    lead: [
      "E5 - - G5 F5 - E5 -",
      "F5 - A5 - C6 - B5 A5",
      "G5 - - E5 B4 - E5 -",
      "F#5 - E5 D5 - A4 D5 -",
      "E5 - G5 - C6 - B5 G5",
      "A5 - F5 - C5 - F5 A5",
      "F#5 - - A5 D6 - C6 A5",
      "B5 - - - D#5 - F#5 -",
    ],
    leadWave: "triangle",
    leadVol: 0.1,
    arp: "0.1.2.3.0.1.2.3.",
    kick: "x.......x..x....",
    snare: "....x.......x...",
    hat: "..x...x...x...x.",
    fill: { kick: "x.......x..x....", snare: "....x.......x.xx" },
    drums: 0.7,
  }),
  // 2. Maelstrom: a rolling D minor sea shanty in a storm, rocking bass and a sawtooth lead.
  song({
    bpm: 140,
    pad: ["D3 F3 A3", "C3 E3 G3", "Bb2 D3 F3", "A2 C#3 E3", "D3 F3 A3", "G2 Bb2 D3", "Bb2 D3 F3", "A2 C#3 E3"],
    padWave: "sawtooth",
    padCut: 1000,
    padAttack: 0.12,
    bass: ["D2", "C2", "Bb1", "A1", "D2", "G1", "Bb1", "A1"],
    bassPat: "x.x.o.x.x.x.o.x.",
    bassMax: 2,
    bassCut: 600,
    lead: [
      "D5 - A4 - D5 E5 F5 -",
      "E5 - C5 - G4 - C5 E5",
      "F5 - D5 - Bb4 - D5 F5",
      "E5 - - C#5 A4 - - -",
      "A5 - F5 - D5 - A5 -",
      "G5 - Bb5 - A5 G5 F5 D5",
      "F5 - D5 - Bb4 - F5 G5",
      "E5 - C#5 - A4 - E5 -",
    ],
    leadWave: "sawtooth",
    leadVol: 0.05,
    arp: null,
    kick: "x.....x...x.....",
    snare: "....x.......x...",
    hat: "x.x.x.x.x.x.x.o.",
    fill: { kick: "x.....x...x.....", snare: "....x...x.x.xxxx" },
    drums: 0.9,
  }),
  // 3. Magmaw: a slow, heavy C minor stomp, low bass and big drums like a volcano walking.
  song({
    bpm: 104,
    pad: ["C3 Eb3 G3", "C3 Eb3 G3", "Ab2 C3 Eb3", "G2 B2 D3", "C3 Eb3 G3", "F2 Ab2 C3", "Ab2 C3 Eb3", "G2 B2 D3"],
    padWave: "sawtooth",
    padCut: 700,
    padAttack: 0.2,
    bass: ["C2", "C2", "Ab1", "G1", "C2", "F1", "Ab1", "G1"],
    bassPat: "x.x.....x.x.....",
    bassMax: 4,
    bassCut: 380,
    lead: [
      "C5 - - - G4 - C5 Eb5",
      "D5 - C5 - G4 - - -",
      "Eb5 - - - Ab4 - C5 Eb5",
      "D5 - - - B4 - G4 -",
      "G5 - - - Eb5 - C5 -",
      "F5 - Eb5 - C5 - Ab4 -",
      "Eb5 - F5 - G5 - Ab5 -",
      "G5 - - - B4 - D5 -",
    ],
    leadWave: "square",
    leadVol: 0.055,
    arp: null,
    kick: "x.x.....x.x.....",
    snare: "....x.......x...",
    hat: "....x...x...x...",
    fill: { kick: "x.x.....x.x.x.x.", snare: "....x.......xxxx" },
    drums: 1.1,
  }),
  // 4. Everwinter: a slow music box in A minor over a ticking clock, as if time has frozen.
  song({
    bpm: 84,
    pad: ["A3 C4 E4", "F3 A3 C4", "C3 E3 G3", "G3 B3 D4", "A3 C4 E4", "D3 F3 A3", "E3 G#3 B3", "E3 G#3 B3"],
    padWave: "triangle",
    padCut: 1400,
    padAttack: 1.2,
    bass: ["A1", "F1", "C2", "G1", "A1", "D2", "E1", "E1"],
    bassPat: "x...............",
    bassMax: 16,
    bassCut: 350,
    lead: [
      "E5 - - - A5 - - -",
      "C6 - - - A5 - F5 -",
      "G5 - - - E5 - C5 -",
      "D5 - - - B4 - G4 -",
      "A4 - C5 - E5 - A5 -",
      "F5 - - - D5 - A4 -",
      "B4 - - - G#4 - B4 -",
      "E5 - - - - - - -",
    ],
    leadWave: "sine",
    leadVol: 0.12,
    arp: "0123321001233210",
    kick: "x...............",
    snare: "........x.......",
    hat: "x...x...x...x...",
    fill: { kick: "x.......x.......", snare: "........x......." },
    drums: 0.45,
  }),
  // 5. The Riftmaker: chords that slide to places they should not go, with a spinning arpeggio.
  song({
    bpm: 120,
    pad: ["F#3 A3 C#4", "G3 B3 D4", "F#3 A3 C#4", "Eb3 G3 Bb3", "D3 F#3 A3", "E3 G#3 B3", "C3 E3 G3", "C#3 F3 G#3"],
    padWave: "sawtooth",
    padCut: 1200,
    padAttack: 0.4,
    bass: ["F#1", "G1", "F#1", "Eb2", "D2", "E2", "C2", "C#2"],
    bassPat: "x...x.o.x...x.o.",
    bassMax: 3,
    bassCut: 520,
    lead: [
      "F#5 - A5 - C#6 - A5 F#5",
      "G5 - - B5 D6 - B5 -",
      "C#6 - A5 - F#5 - C#5 -",
      "Bb5 - G5 - Eb5 - Bb4 -",
      "A5 - F#5 - D5 - A5 -",
      "G#5 - B5 - E6 - B5 G#5",
      "G5 - E5 - C5 - E5 G5",
      "G#5 - F5 - C#5 - - -",
    ],
    leadWave: "triangle",
    leadVol: 0.11,
    arp: "0213021302130213",
    kick: "x.......x...x...",
    snare: "....x.......x...",
    hat: "..x.x...x.x...x.",
    fill: { kick: "x.......x...x...", snare: "....x.......x.xx" },
    drums: 0.8,
  }),
  // 6. The Hollow King: a funeral march in D harmonic minor with an organ-like lead.
  song({
    bpm: 92,
    pad: ["D3 F3 A3", "D3 F3 A3", "G3 Bb3 D4", "A3 C#4 E4", "D3 F3 A3", "Bb2 D3 F3", "G2 Bb2 D3", "A2 C#3 E3"],
    padWave: "sawtooth",
    padCut: 800,
    padAttack: 0.6,
    bass: ["D2", "D2", "G1", "A1", "D2", "Bb1", "G1", "A1"],
    bassPat: "x.......x.......",
    bassMax: 8,
    bassCut: 400,
    lead: [
      "A4 - - - D5 - F5 -",
      "E5 - D5 - C#5 - D5 -",
      "Bb4 - - - D5 - G5 -",
      "F5 - E5 - C#5 - A4 -",
      "D6 - - - C6 - A5 -",
      "Bb5 - A5 - F5 - D5 -",
      "G5 - F5 - E5 - D5 -",
      "C#5 - - - A4 - - -",
    ],
    leadWave: "sawtooth",
    leadVol: 0.05,
    arp: null,
    kick: "x.......x.......",
    snare: "........x.......",
    hat: "....x.......x...",
    fill: { kick: "x.......x...x...", snare: "........x...x.x." },
    drums: 0.7,
  }),
  // 7. The Black Sun: a grand B minor march for the eclipse cult, drums on every beat.
  song({
    bpm: 136,
    pad: ["B2 D3 F#3", "G2 B2 D3", "A2 C#3 E3", "F#2 A#2 C#3", "B2 D3 F#3", "E3 G3 B3", "G2 B2 D3", "F#2 A#2 C#3"],
    padWave: "sawtooth",
    padCut: 1100,
    padAttack: 0.15,
    bass: ["B1", "G1", "A1", "F#1", "B1", "E2", "G1", "F#1"],
    bassPat: "x.x.x.x.x.x.x.x.",
    bassMax: 2,
    bassCut: 560,
    lead: [
      "F#5 - - B5 A5 - F#5 -",
      "G5 - - D5 B4 - D5 -",
      "E5 - - A5 C#6 - A5 -",
      "A#5 - - F#5 C#5 - F#5 -",
      "B5 - D6 - C#6 - B5 A5",
      "G5 - B5 - E5 - G5 -",
      "D6 - B5 - G5 - D5 -",
      "C#5 - F#5 - A#5 - C#6 -",
    ],
    leadWave: "square",
    leadVol: 0.055,
    arp: null,
    kick: "x...x...x...x.x.",
    snare: "....x.......x...",
    hat: "x.x.x.x.x.x.x.o.",
    fill: { kick: "x...x...x.x.x.x.", snare: "....x...x.x.xxxx" },
    drums: 1,
  }),
  // 8. The Axiom: the fastest theme, an E minor finale with a racing arpeggio across the stars.
  song({
    bpm: 152,
    pad: ["E3 G3 B3", "C3 E3 G3", "G3 B3 D4", "D3 F#3 A3", "E3 G3 B3", "C3 E3 G3", "A2 C3 E3", "B2 D#3 F#3"],
    padWave: "sawtooth",
    padCut: 1300,
    padAttack: 0.1,
    bass: ["E2", "C2", "G1", "D2", "E2", "C2", "A1", "B1"],
    bassPat: "x.xox.xox.xox.xo",
    bassMax: 2,
    bassCut: 700,
    lead: [
      "B4 - E5 - G5 - B5 -",
      "C6 - B5 - G5 - E5 -",
      "D6 - - B5 G5 - D5 -",
      "F#5 - A5 - D6 - C6 A5",
      "B5 - G5 - E5 - G5 B5",
      "C6 - - E6 D6 - C6 B5",
      "A5 - E5 - C6 - B5 A5",
      "D#6 - - - B5 - F#5 -",
    ],
    leadWave: "square",
    leadVol: 0.055,
    arp: "0123012301230123",
    kick: "x.....x.x.x...x.",
    snare: "....x.......x...",
    hat: "x.x.x.x.x.x.x.x.",
    fill: { kick: "x.....x.x.......", snare: "....x...x.x.xxxx" },
    drums: 1,
  }),
  // Book 2, 1. The Lanternmaw: a drowned hymn. Slow, organ-like C minor chords with a flattened second that
  // never resolves, a bell lead high above, and a heartbeat kick far below the water.
  song({
    bpm: 84,
    pad: ["C3 Eb3 G3", "Db3 F3 Ab3", "C3 Eb3 G3", "Bb2 D3 F3", "Ab2 C3 Eb3", "Db3 F3 Ab3", "G2 B2 D3", "C3 Eb3 G3"],
    padWave: "triangle",
    padCut: 900,
    padAttack: 0.8,
    bass: ["C2", "Db2", "C2", "Bb1", "Ab1", "Db2", "G1", "C2"],
    bassPat: "x.......x.....o.",
    bassMax: 2,
    bassCut: 380,
    lead: [
      "G5 - - - Eb5 - - .",
      "F5 - Ab5 - Db6 - - .",
      "C6 - - Bb5 G5 - - .",
      "F5 - - D5 Bb4 - - .",
      "Eb5 - - - C5 - Ab4 -",
      "Db5 - F5 - Ab5 - Db6 -",
      "B5 - - - D5 - G5 -",
      "C5 - - - . . . .",
    ],
    leadWave: "sine",
    leadVol: 0.12,
    arp: "0...1...2...1...",
    kick: "x..x............",
    snare: "............x...",
    hat: "......x.......x.",
    fill: { kick: "x..x......x..x..", snare: "............x.x." },
    drums: 0.6,
  }),
  // Book 2, 2. The Sporemother: a choir in a rotting wood. Breathy E minor chords that slide a half step down
  // and back like a hive breathing, a wordless lead that rises in thirds, and a slow swaying beat.
  song({
    bpm: 92,
    pad: ["E3 G3 B3", "Eb3 Gb3 Bb3", "E3 G3 B3", "C3 E3 G3", "A2 C3 E3", "Bb2 D3 F3", "B2 D#3 F#3", "E3 G3 B3"],
    padWave: "sawtooth",
    padCut: 700,
    padAttack: 0.6,
    bass: ["E2", "Eb2", "E2", "C2", "A1", "Bb1", "B1", "E2"],
    bassPat: "x.....x.x.......",
    bassMax: 2,
    bassCut: 420,
    lead: [
      "B4 - - G4 - - E4 -",
      "Bb4 - - Gb4 - - Eb4 -",
      "B4 - D5 - G5 - - .",
      "E5 - - D5 C5 - - .",
      "C5 - - E5 - A5 - -",
      "D5 - F5 - Bb5 - - .",
      "D#5 - F#5 - B5 - A5 -",
      "G5 - - E5 - - . .",
    ],
    leadWave: "triangle",
    leadVol: 0.12,
    arp: "0..1..2..1..0...",
    kick: "x.....x.........",
    snare: "........x.......",
    hat: "..x..x..x..x..x.",
    fill: { kick: "x.....x...x.x...", snare: "........x...x.x." },
    drums: 0.7,
  }),
  // Book 2, 3. The Mnemovore: a music box nobody remembers winding. A high, thin lullaby in F# minor that keeps
  // losing its place, a turning arpeggio underneath, and almost no drums, as if the song is being forgotten.
  song({
    bpm: 100,
    pad: ["F#3 A3 C#4", "D3 F#3 A3", "B2 D3 F#3", "C#3 F3 G#3", "F#3 A3 C#4", "G3 B3 D4", "D3 F#3 A3", "C#3 F3 G#3"],
    padWave: "triangle",
    padCut: 1200,
    padAttack: 0.5,
    bass: ["F#2", "D2", "B1", "C#2", "F#2", "G2", "D2", "C#2"],
    bassPat: "x.......x.......",
    bassMax: 1,
    bassCut: 500,
    lead: [
      "C#6 - A5 - F#5 - A5 -",
      "D6 - - C#6 A5 - . .",
      "B5 - D6 - F#6 - - .",
      "F5 - C#5 - G#5 - C#6 -",
      "C#6 - A5 - F#5 - A5 -",
      "B5 - - G5 D5 - . .",
      "A5 - F#5 - D5 - . .",
      "G#5 - - - . . . .",
    ],
    leadWave: "sine",
    leadVol: 0.13,
    arp: "0123012301230123",
    kick: "x...............",
    snare: "................",
    hat: "....x.......x...",
    fill: { kick: "x.......x.......", snare: "............x..." },
    drums: 0.4,
  }),
  // Book 2, 4. The Dustmoth: wings beating in the dark. A fast D minor pulse, fluttering hats like wingbeats,
  // a low square-wave lead circling like a moth round a lamp, and a moonlit major chord it keeps reaching for.
  song({
    bpm: 132,
    pad: ["D3 F3 A3", "Bb2 D3 F3", "C3 E3 G3", "A2 C#3 E3", "D3 F3 A3", "G2 Bb2 D3", "F2 A2 C3", "A2 C#3 E3"],
    padWave: "sawtooth",
    padCut: 1000,
    padAttack: 0.2,
    bass: ["D2", "Bb1", "C2", "A1", "D2", "G1", "F1", "A1"],
    bassPat: "x.x.x.o.x.x.x.o.",
    bassMax: 4,
    bassCut: 520,
    lead: [
      "A4 - F4 A4 D5 - A4 -",
      "Bb4 - F4 Bb4 D5 - F5 -",
      "E5 - C5 G4 E5 - G5 -",
      "C#5 - E5 - A5 - - .",
      "D5 F5 A5 - F5 D5 A4 -",
      "G4 Bb4 D5 - G5 - D5 -",
      "F5 - C5 - A4 - F4 -",
      "E4 - A4 - C#5 - E5 -",
    ],
    leadWave: "square",
    leadVol: 0.07,
    arp: "0.1.2.1.0.1.2.3.",
    kick: "x...x...x...x...",
    snare: "....x.......x...",
    hat: "xxx.xxx.xxx.xxx.",
    fill: { kick: "x...x...x.x.x.x.", snare: "....x...x.xxxxxx" },
    drums: 0.9,
  }),
  // Book 2, 5. The Somnarch: a lullaby that goes wrong. A slow 6/8 sway in Ab major on soft triangle chords, a
  // music-box lead, and a borrowed minor chord that drifts in every few bars like a bad dream.
  song({
    bpm: 84,
    pad: ["Ab3 C4 Eb4", "F3 Ab3 C4", "Db3 F3 Ab3", "Eb3 G3 Bb3", "Ab3 C4 Eb4", "Fb3 Ab3 Cb4", "Db3 Fb3 Ab3", "Eb3 G3 Bb3"],
    padWave: "triangle",
    padCut: 900,
    padAttack: 0.7,
    bass: ["Ab1", "F1", "Db2", "Eb2", "Ab1", "Fb1", "Db2", "Eb2"],
    bassPat: "x.....x.........",
    bassMax: 2,
    bassCut: 380,
    lead: [
      "Eb5 - C5 - Ab4 - C5 -",
      "C5 - - Ab4 F4 - . .",
      "F5 - Db5 - Ab4 - Db5 -",
      "Eb5 - - - Bb4 - G4 -",
      "Eb5 - C5 - Ab4 - C5 -",
      "Cb5 - - Ab4 Fb4 - . .",
      "Ab5 - Fb5 - Db5 - Fb5 -",
      "G5 - - Eb5 Bb4 - . .",
    ],
    leadWave: "sine",
    leadVol: 0.14,
    arp: "0..1..2..1..0...",
    kick: "x...............",
    snare: "........x.......",
    hat: "......x.......x.",
    fill: { kick: "x.......x.......", snare: "........x...x..." },
    drums: 0.45,
  }),
  // Book 2, 6. The Hush: bells with no ring. A sparse C# minor tolling figure on low sines, long silences between
  // phrases, a heartbeat kick and almost nothing else, until the fill hits like a peal you cannot hear.
  song({
    bpm: 76,
    pad: ["C#3 E3 G#3", "A2 C#3 E3", "F#2 A2 C#3", "G#2 C3 D#3", "C#3 E3 G#3", "D3 F#3 A3", "A2 C#3 E3", "G#2 C3 D#3"],
    padWave: "sawtooth",
    padCut: 520,
    padAttack: 0.8,
    bass: ["C#2", "A1", "F#1", "G#1", "C#2", "D2", "A1", "G#1"],
    bassPat: "x.......x.......",
    bassMax: 1,
    bassCut: 360,
    lead: [
      "G#4 - - - . . . .",
      "E4 - - - C#4 - . .",
      "F#4 - - - A4 - . .",
      "G#4 - - - D#5 - - -",
      "G#4 - - - . . . .",
      "A4 - - - F#4 - D4 -",
      "E4 - - - C#4 - . .",
      "C5 - - - G#4 - . .",
    ],
    leadWave: "sine",
    leadVol: 0.15,
    arp: "0...............",
    kick: "x..x............",
    snare: "................",
    hat: "................",
    fill: { kick: "x..x....x..x....", snare: "........x.x.xxxx" },
    drums: 0.55,
  }),
  // Book 2, 7. The Elder Dark: the last fight. A huge B minor march with a tritone that keeps pulling the chords
  // off true, a driving bass, full drums, and a lead that climbs out of the dark into a major chord at the very end.
  song({
    bpm: 140,
    pad: ["B2 D3 F#3", "F2 A2 C3", "G2 B2 D3", "C#3 E3 G3", "B2 D3 F#3", "F2 Ab2 C3", "E2 G2 B2", "F#2 A#2 C#3"],
    padWave: "sawtooth",
    padCut: 1100,
    padAttack: 0.15,
    bass: ["B1", "F1", "G1", "C#2", "B1", "F1", "E1", "F#1"],
    bassPat: "x.xxx.x.x.xxx.x.",
    bassMax: 4,
    bassCut: 600,
    lead: [
      "B4 - D5 - F#5 - - .",
      "F5 - C5 - A4 - - .",
      "G5 - D5 - B4 D5 G5 -",
      "G5 - E5 - C#5 - - .",
      "B5 - F#5 - D5 - B4 -",
      "C6 - Ab5 - F5 - C5 -",
      "B5 - G5 - E5 - B4 -",
      "A#5 - C#6 - F#6 - - -",
    ],
    leadWave: "square",
    leadVol: 0.08,
    arp: "0.1.2.1.0.1.2.3.",
    kick: "x...x...x...x.x.",
    snare: "....x.......x...",
    hat: "x.x.x.x.x.x.x.xx",
    fill: { kick: "x.x.x.x.x.x.xxxx", snare: "....x.x.x.xxxxxx" },
    drums: 1,
  }),
  // Book 3, 1. Perihelion: a comet crossing a winter sky. Bright, cold E minor on glassy triangle chords, a fast
  // sparkling arpeggio, and a lead that keeps streaking down an octave like something falling, until a B major lifts it.
  song({
    bpm: 126,
    pad: ["E3 G3 B3", "C3 E3 G3", "G3 B3 D4", "D3 F#3 A3", "E3 G3 B3", "A2 C3 E3", "C3 E3 G3", "B2 D#3 F#3"],
    padWave: "triangle",
    padCut: 1400,
    padAttack: 0.3,
    bass: ["E2", "C2", "G1", "D2", "E2", "A1", "C2", "B1"],
    bassPat: "x...x.o.x...x.o.",
    bassMax: 3,
    bassCut: 520,
    lead: [
      "B5 - G5 E5 B4 - . .",
      "C6 - G5 E5 C5 - . .",
      "D6 - B5 G5 D5 - G5 -",
      "F#5 - A5 - D6 - - .",
      "E6 - B5 - G5 E5 B4 -",
      "A5 - E5 - C6 - A5 -",
      "G5 - E5 - C5 - E5 -",
      "D#5 - F#5 - B5 - - -",
    ],
    leadWave: "triangle",
    leadVol: 0.13,
    arp: "0123012301230123",
    kick: "x.......x.......",
    snare: "....x.......x...",
    hat: "x.x.x.x.x.x.x.x.",
    fill: { kick: "x.......x.x.x...", snare: "....x.......xxxx" },
    drums: 0.7,
  }),
  // Book 3, 2. Asterion: the hunt across the sky. A horn call in D dorian over a galloping bass, a bright major
  // fourth chord where a minor one should be, and a lead that climbs like an arrow and lands back on D.
  song({
    bpm: 112,
    pad: ["D3 F3 A3", "C3 E3 G3", "G2 B2 D3", "D3 F3 A3", "Bb2 D3 F3", "C3 E3 G3", "A2 C#3 E3", "D3 F3 A3"],
    padWave: "sawtooth",
    padCut: 900,
    padAttack: 0.25,
    bass: ["D2", "C2", "G1", "D2", "Bb1", "C2", "A1", "D2"],
    bassPat: "x.xx.xx.x.xx.xx.",
    bassMax: 4,
    bassCut: 560,
    lead: [
      "A4 - D5 - A5 - - .",
      "G5 - E5 - C5 - - .",
      "B4 - D5 - G5 - B5 -",
      "A5 - F5 - D5 - - .",
      "F5 - Bb5 - D6 - - .",
      "C6 - G5 - E5 - C5 -",
      "E5 - A5 - C#6 - E6 -",
      "D6 - - - A5 - D5 -",
    ],
    leadWave: "square",
    leadVol: 0.07,
    arp: "0.2.1.2.0.2.1.3.",
    kick: "x..x..x.x..x..x.",
    snare: "....x.......x...",
    hat: "x.xx.xx.x.xx.xx.",
    fill: { kick: "x..x..x.x.x.x.xx", snare: "....x...x.x.xxxx" },
    drums: 0.85,
  }),
  // Book 3, 3. Carina: a lullaby from inside a nebula. Slow, wide F lydian on soft triangle chords, the bright raised
  // fourth floating over everything, a lead that drifts up like gas and a hush of drums that only half wakes.
  song({
    bpm: 88,
    pad: ["F3 A3 C4", "G3 B3 D4", "E3 G3 C4", "D3 F3 A3", "F3 A3 C4", "G3 B3 D4", "A3 C4 E4", "C3 E3 G3"],
    padWave: "triangle",
    padCut: 1200,
    padAttack: 0.8,
    bass: ["F2", "G2", "C2", "D2", "F2", "G2", "A1", "C2"],
    bassPat: "x.......x.......",
    bassMax: 6,
    bassCut: 380,
    lead: [
      "C5 - - - A5 - G5 -",
      "B5 - - - D6 - B5 -",
      "C6 - G5 - E5 - - .",
      "D5 - F5 - A5 - - -",
      "C6 - - - B5 - A5 -",
      "G5 - B5 - D6 - - .",
      "E6 - C6 - A5 - E5 -",
      "G5 - - - - - . .",
    ],
    leadWave: "sine",
    leadVol: 0.15,
    arp: "0.1.2.3.2.1.0.2.",
    kick: "x...............",
    snare: "........x.......",
    hat: "..x...x...x...x.",
    fill: { kick: "x.......x...x...", snare: "........x...x.xx" },
    drums: 0.45,
  }),
  // Book 3, 4. Vela: a clock the size of a star. A driving C# phrygian pulse, square-wave bass ticking on every
  // eighth, steady sixteenth hats like a second hand, and a lead that keeps landing back on the same note like a beat.
  song({
    bpm: 132,
    pad: ["C#3 E3 G#3", "D3 F#3 A3", "C#3 E3 G#3", "B2 D3 F#3", "A2 C#3 E3", "D3 F#3 A3", "B2 D#3 F#3", "C#3 E3 G#3"],
    padWave: "sawtooth",
    padCut: 760,
    padAttack: 0.12,
    bass: ["C#2", "D2", "C#2", "B1", "A1", "D2", "B1", "C#2"],
    bassPat: "x.x.x.x.x.x.x.x.",
    bassMax: 2,
    bassCut: 640,
    lead: [
      "G#5 . G#5 . E5 - C#5 -",
      "A5 . A5 . F#5 - D5 -",
      "G#5 . G#5 . B5 - G#5 -",
      "F#5 - D#5 - B4 - - .",
      "E5 . E5 . A5 - C#6 -",
      "D6 - A5 - F#5 - D5 -",
      "D#5 - F#5 - B5 - D#6 -",
      "C#6 - - - G#5 - C#5 -",
    ],
    leadWave: "square",
    leadVol: 0.06,
    arp: "0303030303030303",
    kick: "x...x...x...x...",
    snare: "....x.......x...",
    hat: "xxxxxxxxxxxxxxxx",
    fill: { kick: "x...x...x.x.x.x.", snare: "....x...x.xxxxxx" },
    drums: 0.8,
  }),
  // Book 3, 5. Aeon: the finale. A wide, slow hymn in D major that sounds older than everything else in the game, huge
  // open sawtooth chords that swell in, a lead that climbs to the top of the sky, and drums that march like a summit climb.
  song({
    bpm: 100,
    pad: ["D3 F#3 A3", "C#3 E3 A3", "B2 D3 F#3", "G2 B2 D3", "D3 F#3 A3", "G2 B2 D3", "E3 G3 B3", "A2 C#3 E3"],
    padWave: "sawtooth",
    padCut: 1400,
    padAttack: 0.5,
    bass: ["D2", "C#2", "B1", "G1", "D2", "G1", "E2", "A1"],
    bassPat: "x.....x.x.......",
    bassMax: 4,
    bassCut: 520,
    lead: [
      "A5 - - - F#5 - D5 -",
      "E5 - - - A5 - C#6 -",
      "D6 - - - B5 - F#5 -",
      "G5 - B5 - D6 - - .",
      "F#6 - - - E6 - D6 -",
      "B5 - D6 - G6 - - -",
      "E6 - D6 - B5 - G5 -",
      "A5 - - - - - . .",
    ],
    leadWave: "triangle",
    leadVol: 0.13,
    arp: "0.1.2.1.0.1.2.3.",
    kick: "x.......x.....x.",
    snare: "....x.......x...",
    hat: "x.x.x.x.x.x.x.x.",
    fill: { kick: "x.......x.x.x.x.", snare: "....x...x.xxxxxx" },
    drums: 0.7,
  }),
];

/** The theme for a Story chapter (0-based). */
export const chapterTheme = (ch: number): MusicTheme => `chapter${Math.max(0, Math.min(CHAPTER_SONGS.length - 1, ch)) + 1}`;
const songFor = (theme: MusicTheme): Song => {
  const m = /^chapter(\d+)$/.exec(theme);
  return m ? CHAPTER_SONGS[Number(m[1]) - 1] ?? SONGS.battle : SONGS[theme as "title" | "battle"];
};

type Playing = { theme: MusicTheme; song: Song; out: GainNode; step: number; next: number };

export class ArenaMusic {
  volume = 0.5;
  muted = false;
  private want: MusicTheme | null = null;
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private cur: Playing | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Read the saved music volume and mute switch. Call after the first render. */
  load(): MusicPrefs {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE) ?? "null");
      if (raw && typeof raw.volume === "number") this.volume = Math.min(1, Math.max(0, raw.volume));
      if (raw && typeof raw.muted === "boolean") this.muted = raw.muted;
    } catch {
      // keep the defaults
    }
    this.apply();
    this.sync();
    return { volume: this.volume, muted: this.muted };
  }

  set(prefs: Partial<MusicPrefs>) {
    if (prefs.volume != null) this.volume = Math.min(1, Math.max(0, prefs.volume));
    if (prefs.muted != null) this.muted = prefs.muted;
    this.apply();
    this.sync();
    try {
      localStorage.setItem(STORE, JSON.stringify({ volume: this.volume, muted: this.muted }));
    } catch {
      // private mode: settings last for this visit only
    }
  }

  /** Which theme the screen wants; null stops the music. It starts once audio is unlocked. */
  play(theme: MusicTheme | null) {
    this.want = theme;
    this.sync();
  }

  /** Browsers only allow sound after a tap or key press: call this from one. */
  unlock() {
    if (typeof window === "undefined") return;
    arenaSound.unlock();
    const o = arenaSound.output;
    if (!o) return;
    if (!this.bus) {
      const { ctx } = o;
      this.ctx = ctx;
      this.bus = ctx.createGain();
      this.bus.gain.value = 0;
      this.bus.connect(o.out);
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      ctx.addEventListener("statechange", () => this.sync());
      // a hidden tab throttles timers, so the music rests until the tab is back
      document.addEventListener("visibilitychange", () => this.sync());
      this.apply();
    }
    this.sync();
  }

  private apply() {
    if (!this.bus || !this.ctx) return;
    const v = this.muted ? 0 : this.volume * this.volume * 0.6;
    this.bus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03);
  }

  private sync() {
    const ctx = this.ctx;
    const on = !!ctx && !!this.bus && ctx.state === "running" && !document.hidden && !this.muted && this.volume > 0 && this.want != null;
    if (this.cur && (!on || this.cur.theme !== this.want)) this.fadeOut();
    if (on && !this.cur && this.want) this.start(this.want);
  }

  private start(theme: MusicTheme) {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, now);
    out.gain.linearRampToValueAtTime(1, now + 0.6);
    out.connect(this.bus!);
    this.cur = { theme, song: songFor(theme), out, step: 0, next: now + 0.08 };
    if (!this.timer) this.timer = setInterval(() => this.tick(), 25);
  }

  private fadeOut() {
    const ctx = this.ctx!;
    const { out } = this.cur!;
    const now = ctx.currentTime;
    out.gain.cancelScheduledValues(now);
    out.gain.setValueAtTime(out.gain.value, now);
    out.gain.linearRampToValueAtTime(0, now + 0.6);
    setTimeout(() => out.disconnect(), 1500);
    this.cur = null;
  }

  /** Schedules notes a little ahead of the audio clock, so timing holds even when a frame is late. */
  private tick() {
    const c = this.cur;
    const ctx = this.ctx;
    if (!c || !ctx) {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      return;
    }
    const stepDur = 60 / c.song.bpm / 4;
    const total = c.song.pad.length * STEPS;
    if (c.next < ctx.currentTime) c.next = ctx.currentTime + 0.05;
    while (c.next < ctx.currentTime + 0.2) {
      this.scheduleStep(c, Math.floor(c.step / STEPS), c.step % STEPS, c.next, stepDur);
      c.step = (c.step + 1) % total;
      c.next += stepDur;
    }
  }

  private scheduleStep(c: Playing, bar: number, s: number, t: number, stepDur: number) {
    const sg = c.song;
    const out = c.out;
    const last = bar === sg.pad.length - 1;
    const chord = sg.pad[bar];

    if (s === 0) for (const n of chord) this.pad(out, t, hz(n), stepDur * STEPS, sg);

    const b = sg.bassPat[s];
    if (b !== ".") {
      let gap = 1;
      while (s + gap < STEPS && sg.bassPat[s + gap] === ".") gap++;
      this.bass(out, t, hz(sg.bass[bar] + (b === "o" ? 12 : 0)), Math.min(gap, sg.bassMax) * stepDur * 0.92, sg.bassCut);
    }

    for (const h of sg.lead[bar]) if (h.step === s) this.lead(out, t, hz(h.midi), h.len * stepDur * 0.95, sg);

    if (sg.arp && sg.arp[s] !== ".") {
      const i = Number(sg.arp[s]);
      const n = i === 3 ? chord[0] + 12 : chord[i];
      this.pluck(out, t, hz(n + 12), stepDur * 1.6);
    }

    const kick = last ? sg.fill.kick : sg.kick;
    const snare = last ? sg.fill.snare : sg.snare;
    if (kick[s] === "x") this.kick(out, t, sg.drums);
    if (snare[s] === "x") this.snare(out, t, sg.drums);
    if (sg.hat[s] !== ".") this.hat(out, t, sg.hat[s] === "o", sg.drums);
  }

  // ── instruments ──

  /** Attack, hold, release envelope on a fresh gain node. */
  private envelope(t: number, peak: number, attack: number, dur: number, release: number) {
    const g = this.ctx!.createGain();
    attack = Math.min(attack, dur * 0.5);
    release = Math.min(release, dur - attack);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + dur - release);
    g.gain.linearRampToValueAtTime(0, t + dur);
    return g;
  }

  private osc(type: OscillatorType, f: number, t: number, dur: number, detune = 0) {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  private lowpass(f: number, q = 0.7) {
    const lp = this.ctx!.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = f;
    lp.Q.value = q;
    return lp;
  }

  private pad(out: AudioNode, t: number, f: number, dur: number, sg: Song) {
    const g = this.envelope(t, 0.03, sg.padAttack, dur, Math.min(0.4, dur * 0.3));
    const lp = this.lowpass(sg.padCut);
    for (const d of [-8, 8]) this.osc(sg.padWave, f, t, dur, d).connect(lp);
    lp.connect(g).connect(out);
  }

  private bass(out: AudioNode, t: number, f: number, dur: number, cut: number) {
    const ctx = this.ctx!;
    const g = this.envelope(t, 0.2, 0.006, dur, Math.min(0.06, dur * 0.4));
    const lp = this.lowpass(cut, 4);
    lp.frequency.setValueAtTime(cut * 2.4, t);
    lp.frequency.exponentialRampToValueAtTime(cut, t + Math.min(0.12, dur));
    this.osc("sawtooth", f, t, dur).connect(lp);
    const sub = this.osc("sine", f, t, dur);
    const sg = ctx.createGain();
    sg.gain.value = 0.6;
    sub.connect(sg).connect(g);
    lp.connect(g).connect(out);
  }

  private lead(out: AudioNode, t: number, f: number, dur: number, sg: Song) {
    const ctx = this.ctx!;
    const g = this.envelope(t, sg.leadVol, 0.012, dur, Math.min(0.08, dur * 0.3));
    const lp = this.lowpass(sg.leadWave === "square" ? 2600 : 5000);
    const a = this.osc(sg.leadWave, f, t, dur);
    const b = this.osc(sg.leadWave === "square" ? "sawtooth" : "sine", sg.leadWave === "square" ? f : f * 2, t, dur, 7);
    // a gentle vibrato that comes in after the note starts
    const lfo = this.osc("sine", 5.5, t, dur);
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.25, dur));
    lfo.connect(depth);
    depth.connect(a.frequency);
    depth.connect(b.frequency);
    const bg = ctx.createGain();
    bg.gain.value = sg.leadWave === "square" ? 0.6 : 0.2;
    a.connect(lp);
    b.connect(bg).connect(lp);
    lp.connect(g).connect(out);
  }

  private pluck(out: AudioNode, t: number, f: number, dur: number) {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.045, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    this.osc("triangle", f, t, dur).connect(g).connect(out);
  }

  private noise(t: number, dur: number) {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noiseBuf;
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
    return src;
  }

  private kick(out: AudioNode, t: number, vol: number) {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.55 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    const o = this.osc("sine", 150, t, 0.22);
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.16);
    o.connect(g).connect(out);
  }

  private snare(out: AudioNode, t: number, vol: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.26 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1900;
    bp.Q.value = 0.8;
    this.noise(t, 0.16).connect(bp).connect(g).connect(out);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.16 * vol, t);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    const o = this.osc("triangle", 200, t, 0.08);
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    o.connect(tg).connect(out);
  }

  private hat(out: AudioNode, t: number, open: boolean, vol: number) {
    const ctx = this.ctx!;
    const dur = open ? 0.2 : 0.045;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.07 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    this.noise(t, dur).connect(hp).connect(g).connect(out);
  }
}

export const arenaMusic = new ArenaMusic();

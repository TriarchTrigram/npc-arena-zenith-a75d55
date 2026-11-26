import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/home";
import { Text, readString, useString, useStrings, type StringKey } from "~stencil/ui/strings";
import { Button } from "~/components/ui/button";
import {
  PageContainer,
  PageHeader,
  SectionHeading,
  Panel,
  PanelBody,
  StatusBadge,
  EmptyState,
} from "~/components/design";
import { Slider } from "~/components/ui/slider";
import { PiSpeakerHighBold, PiSpeakerLowBold, PiSpeakerSlashBold } from "react-icons/pi";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { cn } from "~/lib/utils";
import { DEF_BY_ID, FIGHTERS, NEWGEN_IDS, bossRosterId, defOf, isCustomKey, isNewGen, type FighterDef, type Power, type RosterId } from "~/lib/fighters";
import { useMyFighter } from "~/lib/my-fighter";
import { BOSSES } from "~/lib/bosses";
import { UnlockCutscene } from "~/components/quest-scenes";
import { rememberHybrid, useHybrids } from "~/lib/hybrids";
import { loadQuests, recordFight, recordTournament, rollNewGen, unlockedOf, useQuests } from "~/lib/quests";
import { FusionSheet } from "~/components/fusion-sheet";
import { FighterDot } from "~/components/fighter-dot";
import { W, H, TEAM_COLORS, newGame, step, drawScene, buildBackdrop, setPreFightWords, type Game, type FeedItem } from "~/lib/arena-engine";
import { arenaSound } from "~/lib/arena-sound";
import { arenaMusic, chapterTheme } from "~/lib/arena-music";
import { MusicControl } from "~/components/music-control";
import { drawBracket, recordWinner, nextMatch, champion, progress, started, entrants, type Bracket, type Format, type MatchRef } from "~/lib/bracket";
import { BracketView, type TeamEntry } from "~/components/bracket-view";
import { TitleScreen, type TitleMode } from "~/components/title-screen";
import { FreeWorld } from "~/components/free-world";
import { StoryPanel } from "~/components/story-panel";
import { CHAPTERS, bookOf, bossesBeaten, chapterInBook, endsBook, lairOf, stagesIn, canTeam, chapterOpen, fusionOrder, loadProgress, loadSeenIntros, markIntroSeen, saveProgress, stageLineup, type Pair } from "~/lib/story";
import { StoryScene } from "~/components/story-scene";
import { storyBackdrop } from "~/lib/story-backdrops";
import type { Scene } from "~/lib/story-script";
import { ProgressCodeSheet } from "~/components/progress-code-sheet";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "NPC Arena" },
    { name: "description", content: "Watch 16 superpowered NPCs battle it out in a cartoon arena." },
  ];
}

type Status = "ready" | "running" | "paused" | "finished";
type Mode = "story" | "duel" | "ffa" | "teams" | "tournament" | "teamTournament" | "juggernaut";
type Result = { name: string | null; id: RosterId | null; team: number | null };

type Snapshot = { alive: { key: number; name: string; color: string; hp: number; maxHp: number; kills: number; team: number; jugg: boolean }[]; feed: FeedItem[] };

const SPEEDS = [1, 2, 4] as const;
const MODES: Mode[] = ["story", "duel", "ffa", "teams", "tournament", "teamTournament", "juggernaut"];
/** Juggernaut mode: five challengers (team 0) against one juggernaut (team 1), which goes last. */
const CHALLENGERS = 5;
const JUGG_TEAMS = [...Array(CHALLENGERS).fill(0), 1] as number[];
const TEAM_COUNTS = [2, 3, 4] as const;
const FORMATS: Format[] = ["single", "double"];
/** Team Tournament: fighters per team, and the most fighters a bracket takes. */
const TEAM_SIZES = [2, 3] as const;
const MAX_PICKS = 16;
/** A team's place in the bracket; its number is its colour and name. */
const teamId = (i: number): RosterId => `team${i}`;
const teamIndex = (id: RosterId) => Number(id.slice(4));
/** Picks split into full teams, in pick order; a part team left over sits out. */
const teamsOfPicks = (ids: RosterId[], size: number): RosterId[][] =>
  Array.from({ length: Math.min(Math.floor(ids.length / size), MAX_PICKS / 2) }, (_, t) => ids.slice(t * size, t * size + size));
/** What a double-elimination result means for the fighter who lost it. */
type Fallout = {
  name: string;
  key: "arena.winner.dropped" | "arena.winner.knockedOut" | "arena.winner.resetNeeded" | "arena.winner.teamDropped" | "arena.winner.teamKnockedOut" | "arena.winner.teamResetNeeded";
};
const TEAM_KEYS: StringKey[] = [
  "arena.teams.name0", "arena.teams.name1", "arena.teams.name2", "arena.teams.name3",
  "arena.teams.name4", "arena.teams.name5", "arena.teams.name6", "arena.teams.name7",
];
const HINTS: Record<Mode, StringKey> = {
  story: "arena.pick.storyHint",
  duel: "arena.pick.duelHint",
  ffa: "arena.pick.ffaHint",
  teams: "arena.pick.teamsHint",
  tournament: "arena.pick.tournamentHint",
  teamTournament: "arena.pick.teamTourHint",
  juggernaut: "arena.pick.juggHint",
};
const ALL: RosterId[] = FIGHTERS.map((f) => f.id);
/** Picks are roster ids: an original fighter or a saved hybrid. */
const defsOf = (ids: RosterId[]) => ids.map(defOf);
const defaultPicks = (m: Mode, jugg: RosterId): RosterId[] =>
  m === "duel" ? ["pyro", "cryo"] : m === "tournament" || m === "teamTournament" ? ALL.slice(0, 8) : m === "juggernaut" ? ALL.filter((id) => id !== jugg).slice(0, CHALLENGERS) : ALL;

function shuffled<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Home() {
  const [screen, setScreen] = useState<"title" | "arena" | "free">("title");
  const [mode, setMode] = useState<Mode>("ffa");
  const [picked, setPicked] = useState<RosterId[]>(ALL);
  const hybrids = useHybrids();
  // the character you made in Free World; an edited one replaces the old one wherever it was picked
  const me = useMyFighter();
  const mine = me.id ? [me.id] : [];
  useEffect(() => {
    if (!me.id) return;
    const now = me.id;
    setPicked((cur) => (cur.some((id) => isCustomKey(id) && id !== now) ? cur.map((id) => (isCustomKey(id) ? now : id)) : cur));
    setJugg((cur) => (isCustomKey(cur) && cur !== now ? now : cur));
  }, [me.id]);
  const earnedAll = unlockedOf(useQuests());
  const questers = earnedAll.filter((p) => !isNewGen(p));
  const young = earnedAll.filter(isNewGen);
  const [status, setStatus] = useState<Status>("ready");
  const [speed, setSpeed] = useState<number>(1);
  const [snap, setSnap] = useState<Snapshot>({ alive: [], feed: [] });
  const [result, setResult] = useState<Result | null>(null);
  const [teamCount, setTeamCount] = useState<number>(2);
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [format, setFormat] = useState<Format>("single");
  const [fallout, setFallout] = useState<Fallout | null>(null);
  // Team Tournament: its own bracket of teams, and the teams it was drawn from
  const [teamSize, setTeamSize] = useState<number>(2);
  const [teamBracket, setTeamBracket] = useState<Bracket | null>(null);
  const [teamLineup, setTeamLineup] = useState<RosterId[][]>([]);
  const [jugg, setJugg] = useState<RosterId>("pyro");
  // Story mode: each chapter's cleared count is read from this browser after the first render.
  const [clearedAll, setClearedAll] = useState<number[]>(() => CHAPTERS.map(() => 0));
  const [chapter, setChapter] = useState(0);
  const [stage, setStage] = useState(0);
  const [pair, setPair] = useState<Pair>({ a: "pyro", b: "hydro", fuse: true });
  // the chapter and stage of the fight on screen
  const stageRef = useRef<{ ch: number; i: number } | null>(null);
  const cleared = clearedAll[chapter] ?? 0;
  // Story bosses beaten in this browser, playable everywhere but Story
  const bosses = bossesBeaten(clearedAll).map(bossRosterId);
  // unlock cutscenes waiting to play, one after another: a beaten boss, then a new-generation fighter
  type Unlock = { def: FighterDef; eyebrow: StringKey; joined: StringKey };
  const [unlocks, setUnlocks] = useState<Unlock[]>([]);
  const closeUnlock = useCallback(() => setUnlocks((q) => q.slice(1)), []);
  // Story scenes: a chapter's opening, the words before a stage, the boss's last words.
  // Unlocks earned by a boss win wait until its closing scene is over.
  const [scene, setScene] = useState<Scene | null>(null);
  const afterOutro = useRef<Unlock[]>([]);
  useEffect(() => {
    const all = loadProgress().cleared;
    setClearedAll(all);
    // pick up in the furthest chapter that is open
    let ch = 0;
    while (ch + 1 < CHAPTERS.length && chapterOpen(all, ch + 1)) ch++;
    setChapter(ch);
    setStage(Math.min(all[ch] ?? 0, lairOf(ch)));
  }, []);
  const chooseChapter = (ch: number) => {
    if (!chapterOpen(clearedAll, ch)) return;
    setChapter(ch);
    setStage(Math.min(clearedAll[ch] ?? 0, lairOf(ch)));
  };
  // Sound: saved volume and mute are read from this browser after the first render.
  const [volume, setVolume] = useState(60);
  const [muted, setMuted] = useState(false);
  // Theme music has its own volume and mute, saved the same way.
  const [musicVolume, setMusicVolume] = useState(50);
  const [musicMuted, setMusicMuted] = useState(false);
  useEffect(() => {
    const prefs = arenaSound.load();
    setVolume(Math.round(prefs.volume * 100));
    setMuted(prefs.muted);
    const music = arenaMusic.load();
    setMusicVolume(Math.round(music.volume * 100));
    setMusicMuted(music.muted);
    // browsers start audio only after a tap or key press
    const unlock = () => {
      arenaSound.unlock();
      arenaMusic.unlock();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
  const changeVolume = (v: number) => {
    setVolume(v);
    const unmute = v > 0 && muted;
    if (unmute) setMuted(false);
    arenaSound.set({ volume: v / 100, ...(unmute ? { muted: false } : {}) });
  };
  const toggleMute = () => {
    arenaSound.unlock();
    setMuted(!muted);
    arenaSound.set({ muted: !muted });
  };
  const changeMusicVolume = (v: number) => {
    setMusicVolume(v);
    const unmute = v > 0 && musicMuted;
    if (unmute) setMusicMuted(false);
    arenaMusic.set({ volume: v / 100, ...(unmute ? { muted: false } : {}) });
  };
  const toggleMusic = () => {
    arenaMusic.unlock();
    setMusicMuted(!musicMuted);
    arenaMusic.set({ muted: !musicMuted });
  };
  // The title theme on the title screen, the battle theme in the arena, and in Story the chapter's own theme
  // (on its map and in its fights); leaving the page stops it.
  // Free World picks its own theme: calm while exploring, the battle theme in a fight.
  useEffect(() => {
    if (screen !== "free") arenaMusic.play(screen === "title" ? "title" : mode === "story" ? chapterTheme(chapter) : "battle");
  }, [screen, mode, chapter]);
  useEffect(() => () => arenaMusic.play(null), []);
  const musicControl = <MusicControl volume={musicVolume} muted={musicMuted} onVolume={changeMusicVolume} onToggle={toggleMusic} />;
  const muteAria = useString(muted ? "arena.controls.unmute" : "arena.controls.mute");
  const volumeAria = useString("arena.controls.volume");
  const soundAria = useString("arena.controls.soundAria");
  const canvasAria = useString("arena.canvasAria");
  // the words fighters say to each other before READY
  const allStrings = useStrings();
  useEffect(() => {
    setPreFightWords((key) => readString(allStrings, `arena.prefight.${key}`) ?? "");
  }, [allStrings]);
  const titleBackAria = useString("title.backAria");
  const speedAria = useString("arena.controls.speedAria");
  const juggAria = useString("arena.jugg.label");
  const formatAria = useString("arena.bracket.formatLabel");
  const teamNames = [
    useString("arena.teams.name0"), useString("arena.teams.name1"), useString("arena.teams.name2"), useString("arena.teams.name3"),
    useString("arena.teams.name4"), useString("arena.teams.name5"), useString("arena.teams.name6"), useString("arena.teams.name7"),
  ];
  const teamSizeAria = useString("arena.teamTour.sizeLabel");
  const matchRef = useRef<MatchRef | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const previewRef = useRef<Game | null>(null);
  const statusRef = useRef<Status>("ready");
  const speedRef = useRef(1);
  statusRef.current = status;
  speedRef.current = speed;

  const validFor = (m: Mode, n: number) =>
    m === "story" ? stage <= cleared : m === "duel" ? n === 2 : m === "teams" ? n >= teamCount * 2 && n <= 16 : m === "teamTournament" ? n % teamSize === 0 && n / teamSize >= 3 && n <= MAX_PICKS : m === "juggernaut" ? n === CHALLENGERS && !picked.includes(jugg) : n >= 3 && n <= 16;
  const valid = validFor(mode, picked.length);
  const teamsFor = (ids: RosterId[]) => ids.map((_, i) => i % teamCount);
  // Tournament and Team Tournament share the bracket flow; each keeps its own bracket.
  const tourMode = mode === "tournament" || mode === "teamTournament";
  const teamTour = mode === "teamTournament";
  const bk = teamTour ? teamBracket : mode === "tournament" ? bracket : null;
  const setBk = teamTour ? setTeamBracket : setBracket;
  const upNext = tourMode && bk ? nextMatch(bk) : null;
  const champ = bk ? champion(bk) : null;
  const tourLive = tourMode && !!bk && started(bk) && !champ;
  /** A bracket entrant's name: a fighter, or a team's colour name. */
  const entrantName = (id: RosterId) => (teamTour ? teamNames[teamIndex(id)] ?? "" : defOf(id).name);
  const teamEntries: Record<string, TeamEntry> = Object.fromEntries(
    teamLineup.map((members, i) => [teamId(i), { name: teamNames[i] ?? "", color: TEAM_COLORS[i % TEAM_COLORS.length], members }]),
  );
  /** Both teams of a team match, with each fighter's team number so the arena colours them to match the bracket. */
  const matchLineup = (a: RosterId, b: RosterId) => {
    const ia = teamIndex(a);
    const ib = teamIndex(b);
    const A = teamLineup[ia] ?? [];
    const B = teamLineup[ib] ?? [];
    return { ids: [...A, ...B], teams: [...A.map(() => ia), ...B.map(() => ib)] };
  };
  const drawTeams = () => {
    const lineup = teamsOfPicks(picked, teamSize);
    setTeamLineup(lineup);
    setTeamBracket(validFor("teamTournament", picked.length) ? drawBracket(lineup.map((_, i) => teamId(i)), format) : null);
  };

  // Called from the animation loop the moment a fight is decided.
  const finishRef = useRef<(g: Game) => void>(() => {});
  finishRef.current = (g: Game) => {
    statusRef.current = "finished";
    setResult({ name: g.winner, id: g.winnerId, team: g.winnerTeam });
    const at = matchRef.current;
    // the bracket entrant who won: a fighter, or in Team Tournament the team left standing
    const won = teamTour ? (g.winnerTeam != null ? teamId(g.winnerTeam) : null) : g.winnerId;
    if (tourMode && at != null && won) {
      const next = bk ? recordWinner(bk, at, won) : bk;
      setBk(next);
      // double elimination: say where the loser goes
      const played = next?.format === "double" ? next.matches[at] : null;
      if (played?.loser && !champion(next!)) {
        const grandFinal = played.section === "grand" && !played.reset;
        setFallout(
          grandFinal
            ? { name: entrantName(played.winner!), key: teamTour ? "arena.winner.teamResetNeeded" : "arena.winner.resetNeeded" }
            : {
                name: entrantName(played.loser),
                key: played.section === "winners"
                  ? teamTour ? "arena.winner.teamDropped" : "arena.winner.dropped"
                  : teamTour ? "arena.winner.teamKnockedOut" : "arena.winner.knockedOut",
              },
        );
      } else setFallout(null);
      // the final just crowned a champion: that counts toward quests
      if (next && champion(next) && !(bk && champion(bk))) recordTournament();
    }
    // every fight played to the end counts toward quests
    recordFight({
      kos: g.fighters.filter((f) => !f.alive).length,
      forms: g.fighters.filter((f) => f.form && f.form.kind !== "phase").length,
      boss: mode === "story" && stageRef.current != null && stageRef.current.i === lairOf(stageRef.current.ch) && g.winnerTeam === 0,
    });
    matchRef.current = null;
    const at0 = stageRef.current;
    if (mode === "story" && at0 != null && g.winnerTeam === 0) {
      // the first win over a chapter's boss adds it to the roster
      const beaten = CHAPTERS[at0.ch]?.stages[at0.i]?.boss;
      const queued: Unlock[] = [];
      if (beaten && (clearedAll[at0.ch] ?? 0) < stagesIn(at0.ch)) {
        queued.push({ def: BOSSES[beaten], eyebrow: "arena.bosses.unlockEyebrow", joined: "arena.bosses.unlockJoined" });
      }
      // every boss win, first or replayed, is a chance for a new-generation fighter to join
      const young = beaten ? rollNewGen() : null;
      if (young) queued.push({ def: DEF_BY_ID[young], eyebrow: "arena.newgen.unlockEyebrow", joined: "arena.newgen.unlockJoined" });
      if (beaten) {
        afterOutro.current = queued;
        window.setTimeout(() => setScene({ kind: "outro", ch: at0.ch, stage: at0.i }), 1600);
      } else if (queued.length) window.setTimeout(() => setUnlocks((q) => [...q, ...queued]), 1600);
      setClearedAll((all) => {
        const next = [...all];
        next[at0.ch] = Math.max(next[at0.ch] ?? 0, at0.i + 1);
        saveProgress({ cleared: next });
        return next;
      });
    }
    setStatus("finished");
  };

  // Story stages each have their own painting; every other mode fights in the home arena.
  const backdropRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    backdropRef.current = mode === "story" ? storyBackdrop(chapter, stage) : null;
  }, [mode, chapter, stage, screen]);

  // A chapter's opening scene plays the first time it is opened in this browser.
  useEffect(() => {
    if (screen !== "arena" || mode !== "story" || scene || status === "running" || status === "paused") return;
    if (!loadSeenIntros().includes(chapter)) setScene({ kind: "intro", ch: chapter, stage: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, mode, chapter]);

  const closeScene = () => {
    const done = scene;
    setScene(null);
    if (!done) return;
    if (done.kind === "intro") markIntroSeen(done.ch);
    else if (done.kind === "stage") startStage(done.stage, done.ch);
    // the last boss of Book 2 or Book 3 falls: its last words lead into the book's ending before any unlocks
    else if (done.kind === "outro" && endsBook(done.ch) && bookOf(done.ch) >= 1) setScene({ kind: "ending", ch: done.ch, stage: done.stage });
    else if (afterOutro.current.length) {
      const queued = afterOutro.current;
      afterOutro.current = [];
      setUnlocks((q) => [...q, ...queued]);
    }
  };
  /** A Story stage starts with its scene; the fight begins when the scene ends. */
  const playStage = (i: number, ch = chapter) => {
    setChapter(ch);
    setStage(i);
    setScene({ kind: "stage", ch, stage: i });
  };

  const readSnap = useCallback((g: Game): Snapshot => ({
    alive: g.fighters
      .filter((f) => f.alive)
      .sort((a, b) => a.team - b.team || b.hp / b.maxHp - a.hp / a.maxHp)
      .map((f) => ({ key: f.key, name: f.def.name, color: f.def.color, hp: Math.ceil(f.hp), maxHp: f.maxHp, kills: f.kills, team: f.team, jugg: f.jugg })),
    feed: g.feed.slice(0, 12),
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const home = buildBackdrop();
    let raf = 0;
    let last = performance.now();
    let snapTimer = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const g = gameRef.current;
      if (g && statusRef.current === "running") {
        // the entrances and a rage cutscene always play at normal speed
        const sub = g.cut || g.intro ? 1 : speedRef.current;
        for (let i = 0; i < sub && !g.over; i++) step(g, dt);
        arenaSound.play(g.sfx);
        g.sfx.length = 0;
        snapTimer += dt;
        if (snapTimer > 0.2 || g.over) {
          snapTimer = 0;
          setSnap(readSnap(g));
        }
        if (g.over) finishRef.current(g);
      }
      const backdrop = backdropRef.current ?? home;
      if (g) drawScene(ctx, g, backdrop);
      else {
        const p = previewRef.current ?? newGame([], true);
        step(p, dt);
        drawScene(ctx, p, backdrop);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // The canvas only exists on the arena screen, so the loop restarts when it appears.
  }, [readSnap, screen]);

  // A fresh bracket whenever the picks change, unless a tournament is already under way.
  useEffect(() => {
    if (mode === "tournament") {
      setBracket((cur) => (cur && started(cur) && !champion(cur) ? cur : validFor("tournament", picked.length) ? drawBracket(picked, format) : null));
    } else if (mode === "teamTournament") {
      if (teamBracket && started(teamBracket) && !champion(teamBracket)) return;
      drawTeams();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, picked, format, teamSize]);

  // Idle line-up while waiting to start: the next pairing in a tournament, the picks otherwise.
  const upA = upNext != null && bk ? bk.matches[upNext].a : null;
  const upB = upNext != null && bk ? bk.matches[upNext].b : null;
  useEffect(() => {
    if (mode === "tournament") previewRef.current = newGame(upA && upB ? defsOf([upA, upB]) : [], true);
    else if (mode === "teamTournament") {
      const { ids, teams } = upA && upB ? matchLineup(upA, upB) : { ids: [], teams: [] };
      previewRef.current = newGame(defsOf(ids), true, ids.length ? teams : undefined);
    }
    else if (mode === "story") {
      const { defs, teams } = stageLineup(pair, chapter, CHAPTERS[chapter].stages[stage]);
      previewRef.current = newGame(defs, true, teams);
    } else if (mode === "juggernaut") {
      const ids = [...picked.filter((id) => id !== jugg), jugg];
      previewRef.current = newGame(defsOf(ids), true, ids.map((_, i) => (i === ids.length - 1 ? 1 : 0)), ids.length - 1);
    } else previewRef.current = newGame(defsOf(picked), true, mode === "teams" ? picked.map((_, i) => i % teamCount) : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, mode, teamCount, upA, upB, jugg, pair, stage, chapter, teamLineup]);

  const begin = (g: Game) => {
    gameRef.current = g;
    setResult(null);
    setSnap(readSnap(g));
    setStatus("running");
  };

  const startStage = (i: number, ch = chapter) => {
    const { defs, teams } = stageLineup(pair, ch, CHAPTERS[ch].stages[i]);
    if (pair.fuse || !canTeam(pair)) rememberHybrid(...fusionOrder(pair.a, pair.b));
    stageRef.current = { ch, i };
    setChapter(ch);
    setStage(i);
    begin(newGame(defs, false, teams));
  };

  const start = () => {
    if (mode === "story") {
      // a stage opens with its scene; the fight starts when the scene ends
      if (stage <= cleared) playStage(stage);
      return;
    }
    if (tourMode) {
      const at = bk ? nextMatch(bk) : null;
      const m = at != null && bk ? bk.matches[at] : null;
      if (at == null || !m?.a || !m.b) return;
      matchRef.current = at;
      if (teamTour) {
        const { ids, teams } = matchLineup(m.a, m.b);
        begin(newGame(defsOf(ids), false, teams));
      } else begin(newGame(defsOf([m.a, m.b])));
      return;
    }
    if (!valid) return;
    if (mode === "juggernaut") {
      begin(newGame(defsOf([...picked, jugg]), false, JUGG_TEAMS, CHALLENGERS));
      return;
    }
    begin(newGame(defsOf(picked), false, mode === "teams" ? teamsFor(picked) : undefined));
  };

  const restart = () => {
    gameRef.current = null;
    matchRef.current = null;
    setResult(null);
    setFallout(null);
    setSnap({ alive: [], feed: [] });
    setStatus("ready");
  };

  const newTournament = () => {
    restart();
    if (teamTour) drawTeams();
    else setBracket(validFor("tournament", picked.length) ? drawBracket(picked, format) : null);
  };

  const toggle = (id: RosterId) => {
    if (locked) return;
    setPicked((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (mode === "duel") return [...cur.slice(-1), id];
      if (mode === "juggernaut") return id === jugg ? cur : [...cur.slice(cur.length >= CHALLENGERS ? 1 : 0), id];
      return [...cur, id];
    });
  };

  const chooseJugg = (id: RosterId) => {
    if (locked) return;
    setJugg(id);
    setPicked((cur) => cur.filter((x) => x !== id));
  };

  const switchMode = (m: Mode) => {
    if (status === "running" || status === "paused") return;
    restart();
    setMode(m);
    // coming back to a tournament in progress keeps its bracket and its line-up
    const resume = m === "tournament" && bracket && started(bracket) && !champion(bracket);
    const resumeTeams = m === "teamTournament" && teamBracket && started(teamBracket) && !champion(teamBracket);
    setPicked(resume ? entrants(bracket) : resumeTeams ? teamLineup.flat() : defaultPicks(m, jugg));
    if (resume) setFormat(bracket.format);
    if (resumeTeams) {
      setFormat(teamBracket.format);
      setTeamSize(teamLineup[0]?.length ?? 2);
    }
  };

  const enterFromTitle = (m: TitleMode) => {
    if (m === "free") {
      setScreen("free");
      return;
    }
    switchMode(m);
    setScreen("arena");
  };

  // "Fight as …" on the Quests page: open a Duel with that claimed quest fighter already picked.
  const [params, setParams] = useSearchParams();
  const askedFighter = params.get("fighter");
  useEffect(() => {
    if (!askedFighter) return;
    setParams({}, { replace: true, preventScrollReset: true });
    if (!unlockedOf(loadQuests()).includes(askedFighter as Power)) return;
    enterFromTitle("duel");
    setPicked([askedFighter, askedFighter === "pyro" ? "cryo" : "pyro"]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askedFighter]);

  const fighting = status === "running" || status === "paused";
  const chip = (id: RosterId) => (
    <FighterChip
      key={id}
      def={defOf(id)}
      on={picked.includes(id) || (mode === "juggernaut" && id === jugg)}
      disabled={locked || (mode === "juggernaut" && id === jugg)}
      onClick={() => toggle(id)}
      team={teamOfPick(id)}
      juggernaut={mode === "juggernaut" && id === jugg}
    />
  );
  const locked = fighting || tourLive;
  const tour = bk ? progress(bk) : null;
  /** The team a picked fighter is on: in Teams by turns, in Team Tournament in blocks of the team size. */
  function teamOfPick(id: RosterId): number | null {
    const i = picked.indexOf(id);
    if (i < 0) return null;
    if (mode === "teams") return i % teamCount;
    if (teamTour) {
      const t = Math.floor(i / teamSize);
      return t < teamsOfPicks(picked, teamSize).length ? t : null;
    }
    return null;
  }
  const tone = status === "running" ? "success" : status === "paused" ? "warning" : status === "finished" ? "info" : "neutral";

  return (
    <PageContainer>
      <nav className="mb-6 flex items-center gap-2">
        {(screen === "arena" && !fighting && !tourLive) || screen === "free" ? (
          <button
            type="button"
            onClick={() => setScreen("title")}
            aria-label={titleBackAria}
            className="mr-auto font-display text-lg text-foreground transition-colors duration-150 hover:text-foreground-secondary"
          >
            <Text id="common.appName" as="span" />
          </button>
        ) : (
          <Text id="common.appName" className="mr-auto font-display text-lg" />
        )}
        <Button asChild variant="secondary" size="sm"><Link to="/"><Text id="common.arena" /></Link></Button>
        <Button asChild variant="ghost" size="sm"><Link to="/roster"><Text id="common.fighters" /></Link></Button>
        <Button asChild variant="ghost" size="sm"><Link to="/quests"><Text id="common.quests" /></Link></Button>
        <ProgressCodeSheet />
      </nav>

      {screen === "title" ? (
        <TitleScreen onPick={enterFromTitle} music={musicControl} />
      ) : screen === "free" ? (
        <FreeWorld music={musicControl} onExit={() => setScreen("arena")} />
      ) : (
        <>
          <PageHeader
            eyebrow={<Text id="arena.eyebrow" />}
            title={<Text id="arena.title" />}
            subtitle={<Text id="arena.subtitle" />}
            actions={<StatusBadge tone={tone}><Text id={`arena.status.${status}` as StringKey} /></StatusBadge>}
          />

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-6">
          <Panel>
            <PanelBody className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {status === "ready" && (
                  <Button onClick={start} disabled={tourMode ? upNext == null : !valid}><Text id="arena.controls.start" /></Button>
                )}
                {status === "running" && (
                  <Button variant="secondary" onClick={() => setStatus("paused")}><Text id="arena.controls.pause" /></Button>
                )}
                {status === "paused" && (
                  <Button onClick={() => setStatus("running")}><Text id="arena.controls.resume" /></Button>
                )}
                {status !== "ready" && (
                  <Button variant="outline" onClick={restart}><Text id="arena.controls.restart" /></Button>
                )}
                {tourMode && tour && tour.total > 0 && !champ && (
                  <Text id="arena.bracket.matchOf" vars={{ n: Math.min(tour.played + (status === "finished" ? 0 : 1), tour.total), total: tour.total }} className="text-sm text-muted-foreground tabular-nums" />
                )}
                <div className="ml-auto flex items-center gap-2" role="group" aria-label={speedAria}>
                  <Text id="arena.controls.speed" className="text-sm text-muted-foreground" />
                  {SPEEDS.map((s) => (
                    <Button key={s} size="sm" variant={speed === s ? "default" : "outline"} onClick={() => setSpeed(s)} className="tabular-nums">
                      {`${s}x`}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2" role="group" aria-label={soundAria}>
                  <Button size="sm" variant={muted ? "secondary" : "outline"} onClick={toggleMute} aria-label={muteAria} aria-pressed={muted}>
                    {muted || volume === 0 ? <PiSpeakerSlashBold className="size-5" /> : volume < 45 ? <PiSpeakerLowBold className="size-5" /> : <PiSpeakerHighBold className="size-5" />}
                  </Button>
                  <Slider
                    className="w-28"
                    min={0}
                    max={100}
                    step={5}
                    value={[muted ? 0 : volume]}
                    onValueChange={(v) => changeVolume(v[0] ?? 0)}
                    aria-label={volumeAria}
                  />
                </div>
                {musicControl}
              </div>
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  width={W}
                  height={H}
                  aria-label={canvasAria}
                  role="img"
                  className="block h-auto w-full rounded-xl border-4 border-border bg-background-secondary text-foreground"
                />
                {status === "ready" && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                    {mode === "story" ? (
                      <Text id="arena.idleStory" vars={{ n: stage + 1 }} as="p" className="rounded-full bg-card px-6 py-3 text-center font-display text-lg text-foreground" />
                    ) : (
                      <Text id={tourMode ? "arena.idleTournament" : "arena.idle"} as="p" className="rounded-full bg-card px-6 py-3 text-center font-display text-lg text-foreground" />
                    )}
                  </div>
                )}
                {status === "finished" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
                    <div className="rounded-2xl border-4 border-foreground bg-card px-8 py-6 text-center">
                      {mode === "story" ? (
                        <StoryBanner
                          chapter={stageRef.current?.ch ?? chapter}
                          stage={stageRef.current?.i ?? stage}
                          won={result?.team === 0}
                          onRetry={() => startStage(stageRef.current?.i ?? stage, stageRef.current?.ch ?? chapter)}
                          onNext={() => { const ch = stageRef.current?.ch ?? chapter; restart(); playStage(Math.min((stageRef.current?.i ?? stage) + 1, lairOf(ch)), ch); }}
                          onNextChapter={() => { const ch = Math.min((stageRef.current?.ch ?? chapter) + 1, CHAPTERS.length - 1); setChapter(ch); setStage(0); restart(); }}
                          onBack={() => { setStage(Math.min((stageRef.current?.i ?? stage) + 1, lairOf(stageRef.current?.ch ?? chapter))); restart(); }}
                        />
                      ) : (
                      <WinnerBanner
                        mode={mode}
                        result={result}
                        champ={champ ? entrantName(champ) : null}
                        teamName={result?.team != null ? teamNames[result.team] : null}
                        teamColor={result?.team != null ? TEAM_COLORS[result.team] : null}
                        onAgain={start}
                        onNewTournament={newTournament}
                        fallout={fallout}
                      />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </PanelBody>
          </Panel>

          {tourMode && (
            <section data-bracket-section>
              <SectionHeading
                title={<Text id="arena.bracket.title" />}
                action={
                  <Button size="sm" variant="ghost" disabled={fighting || !valid} onClick={newTournament}><Text id="arena.bracket.newBracket" /></Button>
                }
              />
              <Panel className="mt-3">
                <PanelBody>
                  {bk ? (
                    <BracketView bracket={bk} current={fighting ? null : upNext} teams={teamTour ? teamEntries : undefined} />
                  ) : (
                    <Text id={HINTS[mode]} vars={{ size: teamSize, max: MAX_PICKS / teamSize >> 0 }} as="p" className="text-sm text-muted-foreground" />
                  )}
                </PanelBody>
              </Panel>
            </section>
          )}

          <section>
            <SectionHeading
              title={<Text id={mode === "story" ? "story.title" : "arena.pick.title"} />}
              action={mode === "story" ? undefined :
                <div className="flex gap-2">
                  {mode !== "duel" && mode !== "juggernaut" && (
                    <Button size="sm" variant="ghost" disabled={locked} onClick={() => setPicked(ALL)}><Text id="arena.pick.all" /></Button>
                  )}
                  <Button size="sm" variant="ghost" disabled={locked} onClick={() => setPicked([])}><Text id="arena.pick.clear" /></Button>
                </div>
              }
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap gap-2" role="group">
                <Text id="arena.mode.label" className="sr-only" />
                {MODES.map((m) => (
                  <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} disabled={fighting} onClick={() => switchMode(m)}>
                    <Text id={`arena.mode.${m}` as StringKey} />
                  </Button>
                ))}
              </div>
              <Text id={tourLive ? (teamTour ? "arena.pick.teamTourLocked" : "arena.pick.lockedHint") : HINTS[mode]} vars={{ size: teamSize, max: MAX_PICKS / teamSize >> 0 }} className={cn("text-sm", valid ? "text-muted-foreground" : "text-error")} />
              {mode !== "story" && <Text id="arena.pick.count" vars={{ count: picked.length }} className="ml-auto text-sm text-muted-foreground tabular-nums" />}
            </div>
            {mode === "teams" && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Text id="arena.teams.countLabel" className="text-sm text-muted-foreground" />
                {TEAM_COUNTS.map((n) => (
                  <Button key={n} size="sm" variant={teamCount === n ? "default" : "outline"} disabled={locked} onClick={() => setTeamCount(n)} className="tabular-nums">
                    {n}
                  </Button>
                ))}
                <Button size="sm" variant="ghost" disabled={locked || picked.length < 2} onClick={() => setPicked((cur) => shuffled(cur))}>
                  <Text id="arena.teams.shuffle" />
                </Button>
              </div>
            )}
            {teamTour && (
              <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={teamSizeAria} data-team-size-picker>
                <Text id="arena.teamTour.sizeLabel" className="text-sm text-muted-foreground" />
                {TEAM_SIZES.map((n) => (
                  <Button key={n} size="sm" variant={teamSize === n ? "default" : "outline"} disabled={locked} aria-pressed={teamSize === n} onClick={() => setTeamSize(n)} className="tabular-nums">
                    {n}
                  </Button>
                ))}
                <Button size="sm" variant="ghost" disabled={locked || picked.length < 2} onClick={() => setPicked((cur) => shuffled(cur))}>
                  <Text id="arena.teamTour.shuffle" />
                </Button>
              </div>
            )}
            {tourMode && (
              <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={formatAria} data-format-picker>
                <Text id="arena.bracket.formatLabel" className="text-sm text-muted-foreground" />
                {FORMATS.map((f) => (
                  <Button key={f} size="sm" variant={format === f ? "default" : "outline"} disabled={locked} aria-pressed={format === f} onClick={() => setFormat(f)}>
                    <Text id={`arena.bracket.${f}` as StringKey} />
                  </Button>
                ))}
              </div>
            )}
            {mode === "juggernaut" && (
              <div className="mt-3 flex flex-wrap items-center gap-3" data-jugg-picker>
                <Text id="arena.jugg.label" className="text-sm text-muted-foreground" />
                <Select value={jugg} onValueChange={(v) => chooseJugg(v)} disabled={locked}>
                  <SelectTrigger className="w-48" aria-label={juggAria}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...mine, ...ALL, ...questers, ...young, ...bosses, ...hybrids].map((id) => (
                      <SelectItem key={id} value={id}>
                        <FighterDot def={defOf(id)} />
                        {defOf(id).name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Text id="arena.jugg.perks" className="text-sm text-muted-foreground" />
              </div>
            )}
            {mode === "story" ? (
              <div className="mt-6">
                <StoryPanel cleared={clearedAll} chapter={chapter} onChapter={chooseChapter} stage={stage} onStage={(i) => { if (status === "finished") restart(); setStage(i); }} pair={pair} onPair={setPair} locked={fighting} onPlay={() => { restart(); if (stage <= cleared) playStage(stage); }} onIntro={() => setScene({ kind: "intro", ch: chapter, stage: 0 })} />
              </div>
            ) : (
            <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              {ALL.map(chip)}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3" data-arena-me>
              <Text id="arena.me.title" as="h3" className="font-display text-xl text-foreground" />
              {!me.id && (
                <Button variant="ghost" size="sm" className="ml-auto" disabled={locked} onClick={() => enterFromTitle("free")}><Text id="arena.me.make" /></Button>
              )}
            </div>
            {me.id ? (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {mine.map(chip)}
              </div>
            ) : (
              <Text id="arena.me.empty" as="p" className="mt-3 max-w-prose text-sm text-muted-foreground" />
            )}
            <div className="mt-6 flex flex-wrap items-center gap-3" data-arena-questers>
              <Text id="arena.quest.title" as="h3" className="font-display text-xl text-foreground" />
              <Button asChild variant="ghost" size="sm" className="ml-auto"><Link to="/quests"><Text id="arena.quest.link" /></Link></Button>
            </div>
            {questers.length === 0 ? (
              <Text id="arena.quest.empty" as="p" className="mt-3 max-w-prose text-sm text-muted-foreground" />
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {questers.map(chip)}
              </div>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-3" data-arena-newgen>
              <Text id="arena.newgen.title" as="h3" className="font-display text-xl text-foreground" />
              {young.length > 0 && <Text id="arena.newgen.count" vars={{ count: young.length, total: NEWGEN_IDS.length }} className="text-sm text-muted-foreground tabular-nums" />}
            </div>
            {young.length === 0 ? (
              <Text id="arena.newgen.empty" as="p" className="mt-3 max-w-prose text-sm text-muted-foreground" />
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {young.map(chip)}
              </div>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-3" data-arena-bosses>
              <Text id="arena.bosses.title" as="h3" className="font-display text-xl text-foreground" />
              {bosses.length > 0 && <Text id="arena.bosses.count" vars={{ count: bosses.length, total: CHAPTERS.length }} className="text-sm text-muted-foreground tabular-nums" />}
            </div>
            {bosses.length === 0 ? (
              <Text id="arena.bosses.empty" as="p" className="mt-3 max-w-prose text-sm text-muted-foreground" />
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {bosses.map(chip)}
              </div>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-3" data-arena-hybrids>
              <Text id="arena.hybrids.title" as="h3" className="font-display text-xl text-foreground" />
              {hybrids.length > 0 && <Text id="arena.hybrids.count" vars={{ count: hybrids.length }} className="text-sm text-muted-foreground tabular-nums" />}
              <div className="ml-auto">
                <FusionSheet saved={hybrids} />
              </div>
            </div>
            {hybrids.length === 0 ? (
              <Text id="arena.hybrids.empty" as="p" className="mt-3 max-w-prose text-sm text-muted-foreground" />
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {hybrids.map(chip)}
              </div>
            )}
            </>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section>
            <SectionHeading title={<Text id="arena.alive.title" />} />
            <Panel className="mt-3">
              <PanelBody>
                {snap.alive.length === 0 ? (
                  <Text id="arena.alive.empty" as="p" className="text-sm text-muted-foreground" />
                ) : (
                  <ul className="flex flex-col gap-3">
                    {snap.alive.map((a) => (
                      <li key={a.key} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="size-3 shrink-0 rounded-full border-2 border-foreground" style={{ background: a.color }} />
                          <span className="font-semibold text-foreground">{a.name}</span>
                          {mode === "juggernaut" ? (
                            a.jugg && (
                              <span className="rounded-full border-2 border-foreground px-1.5 text-xs font-extrabold text-foreground">
                                <Text id="arena.jugg.badge" />
                              </span>
                            )
                          ) : a.team >= 0 && (
                            <span className="rounded-full border-2 px-1.5 text-xs font-extrabold text-foreground" style={{ borderColor: TEAM_COLORS[a.team] }}>
                              <Text id={TEAM_KEYS[a.team]} />
                            </span>
                          )}
                          <Text id="arena.alive.kills" vars={{ count: a.kills }} className="ml-auto text-muted-foreground tabular-nums" />
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full" style={{ width: `${(a.hp / a.maxHp) * 100}%`, background: a.color }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </PanelBody>
            </Panel>
          </section>
          <section>
            <SectionHeading title={<Text id="arena.feed.title" />} />
            <div className="mt-3">
              {snap.feed.length === 0 ? (
                <EmptyState title={<Text id="arena.feed.emptyTitle" />} body={<Text id="arena.feed.emptyBody" />} />
              ) : (
                <Panel>
                  <PanelBody>
                    <ul className="flex flex-col gap-2 text-sm text-foreground">
                      {snap.feed.map((k) => (
                        <li key={k.id}>
                          {k.killer ? (
                            <Text id="arena.feed.ko" vars={{ killer: k.killer, victim: k.victim }} />
                          ) : (
                            <Text id="arena.feed.fell" vars={{ victim: k.victim }} />
                          )}
                        </li>
                      ))}
                    </ul>
                  </PanelBody>
                </Panel>
              )}
            </div>
          </section>
        </aside>
          </div>
        </>
      )}
      {scene && <StoryScene key={`${scene.kind}-${scene.ch}-${scene.stage}`} scene={scene} pair={pair} onDone={closeScene} />}
      {unlocks[0] && !scene && <UnlockCutscene key={unlocks[0].def.id} def={unlocks[0].def} eyebrow={unlocks[0].eyebrow} joined={unlocks[0].joined} onClose={closeUnlock} />}
    </PageContainer>
  );
}

function StoryBanner({ chapter, stage, won, onRetry, onNext, onNextChapter, onBack }: { chapter: number; stage: number; won: boolean; onRetry: () => void; onNext: () => void; onNextChapter: () => void; onBack: () => void }) {
  const title = "font-display text-3xl text-foreground";
  const last = stage >= lairOf(chapter);
  // the last boss of a whole book; the next book opens after it
  const finale = last && endsBook(chapter);
  const hasNext = chapter + 1 < CHAPTERS.length;
  if (!won) {
    return (
      <>
        <Text id="arena.winner.stageLost" vars={{ n: stage + 1 }} as="p" className={title} />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button onClick={onRetry}><Text id="arena.winner.tryAgain" /></Button>
        </div>
      </>
    );
  }
  return (
    <>
      {finale ? (
        <Text id={bookOf(chapter) === 2 ? "arena.winner.book3Complete" : bookOf(chapter) === 1 ? "arena.winner.book2Complete" : "arena.winner.storyComplete"} as="p" className={cn(title, "max-w-sm text-balance")} />
      ) : (
        <Text id={last ? "arena.winner.chapterCleared" : "arena.winner.stageCleared"} vars={{ n: last ? chapterInBook(chapter) : stage + 1 }} as="p" className={title} />
      )}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {!last && <Button onClick={onNext}><Text id="arena.winner.nextStage" /></Button>}
        {last && hasNext && <Button onClick={onNextChapter}><Text id={finale ? "arena.winner.nextBook" : "arena.winner.nextChapter"} vars={{ n: bookOf(chapter) + 2 }} /></Button>}
        <Button variant="outline" onClick={last ? onRetry : onBack}><Text id={last ? "arena.winner.again" : "arena.winner.changePair"} /></Button>
      </div>
    </>
  );
}

function WinnerBanner({ mode, result, champ, teamName, teamColor, onAgain, onNewTournament, fallout }: {
  mode: Mode;
  result: Result | null;
  champ: string | null;
  teamName: string | null;
  teamColor: string | null;
  onAgain: () => void;
  onNewTournament: () => void;
  fallout: Fallout | null;
}) {
  const title = "font-display text-3xl text-foreground";
  if (mode === "tournament" || mode === "teamTournament") {
    const teamTour = mode === "teamTournament";
    if (teamTour ? result?.team == null : !result?.id) {
      return (
        <>
          <Text id="arena.winner.doubleKo" as="p" className={cn(title, "max-w-sm text-balance")} />
          <Button className="mt-4" onClick={onAgain}><Text id="arena.winner.rematch" /></Button>
        </>
      );
    }
    if (champ) {
      return (
        <>
          {teamTour ? (
            <Text id="arena.winner.teamChampion" vars={{ team: champ }} as="p" className={cn(title, "max-w-sm text-balance")} />
          ) : (
            <Text id="arena.winner.champion" vars={{ name: champ }} as="p" className={title} />
          )}
          <Button className="mt-4" onClick={onNewTournament}><Text id="arena.winner.newTournament" /></Button>
        </>
      );
    }
    return (
      <>
        {teamTour ? (
          <p className="flex items-center justify-center gap-3">
            <span className="size-5 shrink-0 rounded-full border-2 border-foreground" style={{ background: teamColor ?? undefined }} />
            <Text id="arena.winner.teamMatch" vars={{ team: teamName ?? "" }} className={title} />
          </p>
        ) : (
          <Text id="arena.winner.match" vars={{ name: result?.name ?? "" }} as="p" className={title} />
        )}
        {fallout && <Text id={fallout.key} vars={{ name: fallout.name }} as="p" className="mt-2 text-base text-foreground-secondary" />}
        <Button className="mt-4" onClick={onAgain}><Text id="arena.winner.nextMatch" /></Button>
      </>
    );
  }
  if (mode === "juggernaut" && result?.team != null) {
    return (
      <>
        {result.team === 1 ? (
          <Text id="arena.winner.juggernaut" vars={{ name: result.name ?? "" }} as="p" className={title} />
        ) : (
          <Text id="arena.winner.challengers" as="p" className={title} />
        )}
        <Button className="mt-4" onClick={onAgain}><Text id="arena.winner.again" /></Button>
      </>
    );
  }
  return (
    <>
      {teamName ? (
        <p className="flex items-center justify-center gap-3">
          <span className="size-5 rounded-full border-2 border-foreground" style={{ background: teamColor ?? undefined }} />
          <Text id="arena.winner.team" vars={{ team: teamName }} className={title} />
        </p>
      ) : result?.name ? (
        <Text id="arena.winner.title" vars={{ name: result.name }} as="p" className={title} />
      ) : (
        <Text id="arena.winner.draw" as="p" className={title} />
      )}
      <Button className="mt-4" onClick={onAgain}><Text id="arena.winner.again" /></Button>
    </>
  );
}

function FighterChip({ def, on, disabled, onClick, team, juggernaut = false }: { def: FighterDef; on: boolean; disabled: boolean; onClick: () => void; team: number | null; juggernaut?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={cn(
        "flex min-h-10 items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-surface-hover active:bg-surface-active disabled:opacity-60",
        on ? "border-foreground bg-card font-semibold text-foreground" : "border-border bg-background text-muted-foreground",
        juggernaut && "disabled:opacity-100",
      )}
      style={juggernaut ? { borderColor: def.color, boxShadow: `0 0 0 2px ${def.glow}` } : undefined}
    >
      <FighterDot def={def} className="size-5" />
      <span className="truncate">{def.name}</span>
      {juggernaut && <Text id="arena.jugg.badge" className="ml-auto shrink-0 text-xs font-extrabold uppercase tracking-[0.08em] text-foreground" />}
      {team != null && (
        <>
          <span className="ml-auto h-5 w-1.5 shrink-0 rounded-full" style={{ background: TEAM_COLORS[team] }} aria-hidden />
          <Text id={TEAM_KEYS[team]} className="sr-only" />
        </>
      )}
    </button>
  );
}

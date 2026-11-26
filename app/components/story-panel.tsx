import { Text, useString } from "~stencil/ui/strings";
import type { StringKey } from "~stencil/types/strings";
import { Button } from "~/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { cn } from "~/lib/utils";
import { DEF_BY_ID, FIGHTERS, type Power } from "~/lib/fighters";
import { useUnlocked } from "~/lib/quests";
import { useDevUnlocks } from "~/lib/dev-unlocks";
import { PiBookOpenTextFill, PiFastForwardFill, PiFilmSlateBold, PiSwordFill } from "react-icons/pi";
import { BOOKS, CHAPTERS, SKIP_AFTER, bookOf, canSkipToBoss, canTeam, chapterInBook, chapterOpen, chaptersOf, chaptersOfBooks, enemySide, lairOf, playerSide, stagesIn, type Pair } from "~/lib/story";
import { BOSSES } from "~/lib/bosses";
import { FighterDot } from "~/components/fighter-dot";
import { StoryMap } from "~/components/story-map";
import { CHAPTER_TITLES, stageNameKey } from "~/components/story-scene";

export function StoryPanel({ cleared, wins, hasQuester, dev = false, onSkipToBoss, chapter, onChapter, stage, onStage, pair, onPair, locked, onPlay, onIntro }: {
  cleared: number[];
  /** How many times each chapter's boss has been beaten. */
  wins: number[];
  /** Whether this browser owns at least one quest fighter. */
  hasQuester: boolean;
  /** Developer mode: every book, chapter and stage is open, and every boss can be skipped to. */
  dev?: boolean;
  /** Starts the chapter's boss fight at once, with no stages or scene before it. */
  onSkipToBoss: () => void;
  chapter: number;
  onChapter: (ch: number) => void;
  stage: number;
  onStage: (i: number) => void;
  pair: Pair;
  onPair: (p: Pair) => void;
  locked: boolean;
  /** Plays the selected stage: its scene, then the fight. */
  onPlay: () => void;
  /** Replays the chapter's opening scene. */
  onIntro: () => void;
}) {
  const firstAria = useString("story.first");
  const secondAria = useString("story.second");
  const chaptersAria = useString("story.chaptersAria");
  const booksAria = useString("story.books.aria");
  // chapters whose book was picked in developer mode to stay open for good, switch or no switch
  const permOpen = chaptersOfBooks(useDevUnlocks().books);
  const isOpen = (ch: number) => dev || chapterOpen(cleared, ch, permOpen);
  const book = bookOf(chapter);
  const stages = CHAPTERS[chapter].stages;
  const total = stagesIn(chapter);
  /** Opens a book on its furthest open chapter. */
  const openBook = (b: number) => {
    const chs = chaptersOf(b).filter((ch) => isOpen(ch));
    if (chs.length) onChapter(chs[chs.length - 1]);
  };
  const done = cleared[chapter] ?? 0;
  // in developer mode every stage can be played and the map shows them all open
  const reach = dev ? total : done;
  const foes = enemySide(chapter, stages[stage] ?? stages[0]);
  const side = playerSide(pair);
  const teamOk = canTeam(pair);
  const fused = pair.fuse || !teamOk;
  const chapterDone = done >= total;
  const canSkip = dev ? !!stages[lairOf(chapter)]?.boss : canSkipToBoss({ cleared, wins }, chapter, hasQuester);
  const bossId = stages[lairOf(chapter)]?.boss;
  const bossName = bossId ? BOSSES[bossId].name : "";
  // a cleared chapter always has one win, so at most one more is ever needed
  const winsLeft = Math.max(0, SKIP_AFTER - (wins[chapter] ?? 0));

  return (
    <div className="flex flex-col gap-6" data-story-panel>
      <div className="flex flex-col gap-2" data-story-books>
        <div className="-my-1.5 flex gap-2 overflow-x-auto py-1.5" role="group" aria-label={booksAria}>
          {BOOKS.map((b, i) => {
            const open = isOpen(b.first);
            return (
              <Button
                key={i}
                variant={i === book ? "default" : "outline"}
                disabled={!open || locked}
                aria-pressed={i === book}
                onClick={() => openBook(i)}
                className="shrink-0"
              >
                <PiBookOpenTextFill className="size-5" aria-hidden />
                <Text id={`story.books.b${i + 1}` as StringKey} className="whitespace-nowrap" />
                {!open && <Text id="story.locked" className="text-xs" />}
              </Button>
            );
          })}
        </div>
        {/* what opens the next locked book */}
        {(() => {
          const next = BOOKS.findIndex((b, i) => i > 0 && !isOpen(b.first));
          return next > 0 ? <Text id={`story.books.b${next + 1}Locked` as StringKey} as="p" className="text-sm text-muted-foreground" /> : null;
        })()}
      </div>
      <div className="-my-1.5 flex gap-2 overflow-x-auto py-1.5" role="group" aria-label={chaptersAria} data-story-chapters>
        {chaptersOf(book).map((ch) => {
          const open = isOpen(ch);
          return (
            <Button
              key={ch}
              size="sm"
              variant={ch === chapter ? "default" : "outline"}
              disabled={!open || locked}
              aria-pressed={ch === chapter}
              onClick={() => onChapter(ch)}
              className="shrink-0"
            >
              <Text id="story.chapterLabel" vars={{ n: chapterInBook(ch) }} />
              {(cleared[ch] ?? 0) >= stagesIn(ch) ? <Text id="story.cleared" className="text-xs font-extrabold" /> : !open ? <Text id="story.locked" className="text-xs" /> : null}
            </Button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Text id={CHAPTER_TITLES[chapter]} as="h3" className="font-display text-xl text-foreground" />
          <Text id="story.chapterIntro" as="p" className="max-w-prose text-sm text-muted-foreground" />
          <Text id="story.progress" vars={{ count: done, total }} as="p" className="text-sm font-semibold text-foreground tabular-nums" />
          {chapterDone && !canSkip && bossName && (
            <Text
              id={!hasQuester || winsLeft === 0 ? "story.skip.needQuester" : "story.skip.oneMore"}
              vars={{ boss: bossName }}
              as="p"
              className="max-w-prose text-sm text-muted-foreground"
              data-story-skip-hint
            />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canSkip && (
            <Button size="sm" disabled={locked} onClick={onSkipToBoss} data-story-skip>
              <PiFastForwardFill className="size-5" aria-hidden />
              <Text id="story.skip.button" />
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={locked} onClick={onIntro}>
            <PiFilmSlateBold className="size-5" aria-hidden />
            <Text id="story.map.watchIntro" />
          </Button>
        </div>
      </div>

      <StoryMap chapter={chapter} done={done} reach={reach} stage={stage} onStage={onStage} locked={locked} />

      <div className="flex flex-col gap-4 rounded-xl border-2 border-border bg-background-secondary px-4 py-4 sm:flex-row sm:items-end" data-story-stage>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="flex items-center gap-2">
            <Text id="story.stageNumber" vars={{ n: stage + 1 }} className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground" />
            {stage < done ? (
              <Text id="story.cleared" className="text-xs font-extrabold text-success" />
            ) : stages[stage]?.boss ? (
              <Text id="story.boss" className="text-xs font-extrabold text-error" />
            ) : null}
          </span>
          <Text id={stageNameKey(chapter, stage)} as="h4" className="font-display text-xl text-foreground" />
          <Text id="story.map.enemies" as="p" className="text-sm text-muted-foreground" />
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {foes.map((f, k) => (
              <li key={k} className="flex items-center gap-2 text-sm text-foreground">
                <FighterDot def={f} className="size-4" />
                <span className="font-semibold">{f.name}</span>
                {f.minion ? (
                  <>
                    <Text id={`story.minion.${f.minion.kind}` as StringKey} className="text-muted-foreground" />
                    <span className="text-muted-foreground" data-minion-power>
                      <Text id="story.minion.power" vars={{ power: f.power }} />
                    </span>
                  </>
                ) : (
                  <Text id="story.boss" className="text-error" />
                )}
              </li>
            ))}
          </ul>
        </div>
        <Button className="shrink-0" disabled={locked || stage > reach} onClick={onPlay}>
          <PiSwordFill className="size-5" aria-hidden />
          <Text id="story.map.play" />
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <Text id="story.pairTitle" as="h3" className="font-display text-xl text-foreground" />
        <div className="flex flex-wrap items-center gap-3">
          <FighterSelect value={pair.a} label={firstAria} disabled={locked} onChange={(a) => onPair({ ...pair, a })} />
          <FighterSelect value={pair.b} label={secondAria} disabled={locked} onChange={(b) => onPair({ ...pair, b })} />
        </div>
        <div className="flex flex-wrap gap-2" role="group">
          <Button size="sm" variant={fused ? "default" : "outline"} disabled={locked} onClick={() => onPair({ ...pair, fuse: true })}>
            <Text id="story.fuse" />
          </Button>
          <Button size="sm" variant={!fused ? "default" : "outline"} disabled={locked || !teamOk} onClick={() => onPair({ ...pair, fuse: false })}>
            <Text id="story.team" />
          </Button>
        </div>
        <div className="rounded-xl border-2 border-border bg-background-secondary px-4 py-3" data-story-pair>
          {fused ? (
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2">
                <span className="size-4 rounded-full border-2 border-foreground" style={{ background: `linear-gradient(90deg, ${side[0].color} 50%, ${side[0].glow} 50%)` }} aria-hidden />
                <span className="font-display text-lg text-foreground">{side[0].name}</span>
              </span>
              <Text id="story.fuseHint" vars={{ count: side[0].moves.length }} as="p" className="text-sm text-muted-foreground" />
              <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-foreground">
                {side[0].moves.map((m) => (
                  <li key={m.id} className={cn(m.id.startsWith("mix-") && "font-semibold")}>{m.name}</li>
                ))}
              </ul>
              {!teamOk && <Text id="story.sameHint" as="p" className="text-sm text-muted-foreground" />}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Text id="story.teamHint" as="p" className="text-sm text-muted-foreground" />
              <ul className="flex flex-col gap-1 text-sm text-foreground">
                {side.map((f) => (
                  <li key={f.id} className="flex items-center gap-2">
                    <span className="size-3 shrink-0 rounded-full border-2 border-foreground" style={{ background: f.color }} aria-hidden />
                    <span className="font-semibold">{f.name}</span>
                    <span className="text-muted-foreground">{f.moves[f.moves.length - 1].name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Picks one fighter: the 16 originals, then every quest fighter this browser has claimed. */
export function FighterSelect({ value, label, disabled, onChange }: { value: Power; label: string; disabled: boolean; onChange: (p: Power) => void }) {
  const earned = useUnlocked();
  const ids: Power[] = [...FIGHTERS.map((f) => f.id), ...earned];
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Power)} disabled={disabled}>
      <SelectTrigger className="w-48" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ids.map((id) => (
          <SelectItem key={id} value={id}>
            <span className="size-3 shrink-0 rounded-full border-2 border-foreground" style={{ background: DEF_BY_ID[id].color }} />
            {DEF_BY_ID[id].name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

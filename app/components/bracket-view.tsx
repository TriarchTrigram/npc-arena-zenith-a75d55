import { createContext, useContext } from "react";
import { Text, type StringKey } from "~stencil/ui/strings";
import { cn } from "~/lib/utils";
import { defOf, type RosterId } from "~/lib/fighters";
import { FighterDot } from "~/components/fighter-dot";
import { champion, roundsOf, type Bracket, type Match, type MatchRef } from "~/lib/bracket";

const ROUND_KEY: Record<number, StringKey> = {
  1: "arena.bracket.final",
  2: "arena.bracket.semis",
  4: "arena.bracket.quarters",
  8: "arena.bracket.round16",
};

/** Team Tournament: each entrant is a team, shown by its colour, name and members. */
export type TeamEntry = { name: string; color: string; members: RosterId[] };
const TeamsContext = createContext<Record<string, TeamEntry> | null>(null);

const label = "mb-3 text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground";

/**
 * Single elimination: one column per round, then the champion.
 * Double elimination: the winners bracket, the losers bracket, then the grand final
 * (and its reset, once it is needed) beside the champion. The current match is outlined.
 */
export function BracketView({ bracket, current, teams }: { bracket: Bracket; current: MatchRef | null; teams?: Record<string, TeamEntry> }) {
  return (
    <TeamsContext.Provider value={teams ?? null}>
      <Brackets bracket={bracket} current={current} />
    </TeamsContext.Provider>
  );
}

function Brackets({ bracket, current }: { bracket: Bracket; current: MatchRef | null }) {
  const champ = champion(bracket);
  if (bracket.format === "single") {
    return (
      <Scroller>
        {roundsOf(bracket, "winners").map((round, r) => (
          <Column key={r} title={ROUND_KEY[round.length] ?? "arena.bracket.round16"} matches={round} current={current} />
        ))}
        <Champion id={champ} />
      </Scroller>
    );
  }

  const winners = roundsOf(bracket, "winners");
  const losers = roundsOf(bracket, "losers");
  const [grand, reset] = roundsOf(bracket, "grand").flat();
  const resetShown = !!reset && !(reset.done && !reset.winner);
  return (
    <div className="flex flex-col gap-6" data-double-bracket>
      <div>
        <Text id="arena.bracket.winners" as="h3" className="mb-3 font-display text-lg text-foreground" />
        <Scroller>
          {winners.map((round, r) => (
            <Column key={r} title={r === winners.length - 1 ? "arena.bracket.winnersFinal" : ROUND_KEY[round.length] ?? "arena.bracket.round16"} matches={round} current={current} />
          ))}
        </Scroller>
      </div>
      <div className="border-t border-border-subtle pt-6">
        <Text id="arena.bracket.losers" as="h3" className="font-display text-lg text-foreground" />
        <Text id="arena.bracket.losersHint" as="p" className="mb-3 mt-1 max-w-prose text-sm text-muted-foreground" />
        <Scroller>
          {losers.map((round, r) => (
            <Column
              key={r}
              title={r === losers.length - 1 ? "arena.bracket.losersFinal" : "arena.bracket.losersRound"}
              vars={{ n: r + 1 }}
              matches={round}
              current={current}
            />
          ))}
        </Scroller>
      </div>
      <div className="border-t border-border-subtle pt-6">
        <Text id="arena.bracket.grand" as="h3" className="font-display text-lg text-foreground" />
        <Text id="arena.bracket.grandHint" as="p" className="mb-3 mt-1 max-w-prose text-sm text-muted-foreground" />
        <Scroller>
          {grand && <Column title="arena.bracket.grandFinal" matches={[grand]} current={current} />}
          {reset && resetShown && <Column title="arena.bracket.reset" matches={[reset]} current={current} />}
          <Champion id={champ} />
        </Scroller>
      </div>
    </div>
  );
}

function Scroller({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-2">
      <div className="flex min-w-max gap-6">{children}</div>
    </div>
  );
}

function Column({ title, vars, matches, current }: { title: StringKey; vars?: Record<string, string | number>; matches: Match[]; current: MatchRef | null }) {
  return (
    <div className="flex w-48 flex-col">
      <Text id={title} vars={vars} as="p" className={label} />
      <ol className="flex flex-1 flex-col justify-around gap-3">
        {matches.map((m) => (
          <li key={m.id}>
            <MatchCard m={m} live={current === m.id} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function Champion({ id }: { id: RosterId | null }) {
  return (
    <div className="flex w-44 flex-col">
      <Text id="arena.bracket.champion" as="p" className={label} />
      <div className="flex flex-1 items-center">
        <div className={cn("w-full rounded-xl border-2 px-3 py-3", id ? "border-border-strong bg-highlight text-highlight-foreground shadow-sm" : "border-dashed border-border bg-background")}>
          {id ? <Entrant id={id} strong /> : <Text id="arena.bracket.tbd" className="text-sm text-muted-foreground" />}
        </div>
      </div>
    </div>
  );
}

function MatchCard({ m, live }: { m: Match; live: boolean }) {
  return (
    <div className={cn("rounded-xl border-2 bg-card", live ? "border-primary shadow-md" : "border-border")}>
      {live && <Text id="arena.bracket.next" as="p" className="border-b-2 border-primary bg-primary px-3 py-0.5 text-xs font-extrabold uppercase tracking-[0.1em] text-primary-foreground" />}
      <Side id={m.a} none={m.noA} winner={m.winner} />
      <div className="border-t border-border-subtle" />
      <Side id={m.b} none={m.noB} winner={m.winner} />
    </div>
  );
}

function Side({ id, none, winner }: { id: RosterId | null; none: boolean; winner: RosterId | null }) {
  if (!id) {
    return (
      <div className="px-3 py-2">
        <Text id={none ? "arena.bracket.bye" : "arena.bracket.tbd"} className="text-sm text-muted-foreground" />
      </div>
    );
  }
  const lost = !!winner && winner !== id;
  return (
    <div className="px-3 py-2">
      <Entrant id={id} strong={winner === id} lost={lost} />
    </div>
  );
}

function Entrant({ id, strong, lost }: { id: RosterId; strong?: boolean; lost?: boolean }) {
  const team = useContext(TeamsContext)?.[id];
  if (team) return <TeamEntrant team={team} strong={strong} lost={lost} />;
  const def = defOf(id);
  return (
    <span className={cn("flex items-center gap-2 text-sm", strong ? "font-semibold text-foreground" : lost ? "text-muted-foreground" : "text-foreground-secondary")}>
      <FighterDot def={def} />
      <span className="truncate">{def.name}</span>
    </span>
  );
}

function TeamEntrant({ team, strong, lost }: { team: TeamEntry; strong?: boolean; lost?: boolean }) {
  const names = team.members.map((m) => defOf(m).name).join(", ");
  return (
    <span className={cn("flex min-w-0 flex-col gap-1 text-sm", strong ? "font-semibold text-foreground" : lost ? "text-muted-foreground" : "text-foreground-secondary")} title={names} data-team-entrant>
      <span className="flex items-center gap-2">
        <span aria-hidden className="h-4 w-1.5 shrink-0 rounded-full" style={{ background: team.color }} />
        <Text id="arena.teams.tag" vars={{ team: team.name }} className="truncate" />
      </span>
      <span className="flex flex-wrap items-center gap-1 pl-3.5">
        {team.members.map((m) => (
          <FighterDot key={m} def={defOf(m)} />
        ))}
        <span className="sr-only">{names}</span>
      </span>
    </span>
  );
}

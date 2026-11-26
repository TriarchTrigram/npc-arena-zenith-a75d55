import { useCallback, useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/quests";
import { Text, useString } from "~stencil/ui/strings";
import type { StringKey } from "~stencil/types/strings";
import { PiCheckCircleBold, PiLockSimpleBold, PiCircleBold } from "react-icons/pi";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { PageContainer, PageHeader, Panel, PanelBody, StatusBadge } from "~/components/design";
import { FighterPortrait, UnlockCutscene } from "~/components/quest-scenes";
import { DEF_BY_ID, type FighterDef } from "~/lib/fighters";
import { FORMS } from "~/lib/forms";
import { QUESTS, claimQuest, goalDone, questReady, useQuests, type Quest, type Stats } from "~/lib/quests";
import { cn } from "~/lib/utils";
import { ProgressCodeSheet } from "~/components/progress-code-sheet";
import { DevModeSheet } from "~/components/dev-mode-sheet";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Quests | NPC Arena" },
    { name: "description", content: "Complete quests in NPC Arena to earn quest fighters for good." },
  ];
}

function TopBar() {
  const navLabel = useString("roster.navLabel");
  return (
    <nav aria-label={navLabel} className="mb-6 flex flex-wrap items-center gap-1 sm:gap-2 max-sm:[&>:not(:first-child)]:px-1.5">
      <Text id="common.appName" className="mr-auto font-display text-lg" />
      <Button asChild variant="ghost" size="sm"><Link to="/"><Text id="common.arena" /></Link></Button>
      <Button asChild variant="ghost" size="sm"><Link to="/roster"><Text id="common.fighters" /></Link></Button>
      <Button asChild variant="secondary" size="sm"><Link to="/quests" aria-current="page"><Text id="common.quests" /></Link></Button>
      <ProgressCodeSheet />
      <DevModeSheet />
    </nav>
  );
}

function GoalRow({ stats, goal }: { stats: Stats; goal: Quest["goals"][number] }) {
  const have = Math.min(stats[goal.stat], goal.need);
  const done = goalDone(stats, goal);
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-sm">
        {done ? <PiCheckCircleBold className="size-4 shrink-0 text-success" aria-hidden /> : <PiCircleBold className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
        <Text id={`quests.goal.${goal.stat}` as StringKey} vars={{ need: goal.need }} className={cn("text-foreground", done && "font-semibold")} />
        <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">{have} / {goal.need}</span>
      </div>
      <Progress value={(have / goal.need) * 100} aria-label={`${have} / ${goal.need}`} className="h-2" />
    </li>
  );
}

function QuestCard({ quest, n, stats, claimed, onClaim }: { quest: Quest; n: number; stats: Stats; claimed: boolean; onClaim: (def: FighterDef) => void }) {
  const def = quest.reward ? DEF_BY_ID[quest.reward] : null;
  const ready = questReady(stats, quest);
  const doneGoals = quest.goals.filter((g) => goalDone(stats, g)).length;
  const tone = claimed ? "success" : ready ? "warning" : def ? "info" : "neutral";
  const state = claimed ? "claimed" : ready ? "ready" : def ? "open" : "sealed";
  return (
    <Panel className="flex h-full flex-col overflow-hidden">
      <div
        className="relative shrink-0 border-b-2 border-border-subtle"
        style={{ background: def ? `radial-gradient(ellipse at 50% 80%, ${def.glow.replace(")", " / 0.22)")}, transparent 70%), hsl(250 32% 10%)` : "hsl(250 32% 10%)" }}
      >
        {def ? (
          <FighterPortrait def={def} locked={!claimed} />
        ) : (
          <div className="flex aspect-[6/5] items-center justify-center">
            <PiLockSimpleBold className="size-14 text-white/40" aria-hidden />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.1em] text-white tabular-nums">
          <Text id="quests.card.number" vars={{ n }} />
        </span>
      </div>
      <PanelBody className="flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <Text id={`quests.list.${quest.id}.title` as StringKey} as="h3" className="font-display text-xl text-foreground" />
            <Text id={`quests.list.${quest.id}.reward` as StringKey} as="p" className="text-sm text-muted-foreground" />
          </div>
          <StatusBadge tone={tone}><Text id={`quests.state.${state}` as StringKey} /></StatusBadge>
        </div>
        <Text id={`quests.list.${quest.id}.story` as StringKey} as="p" className="text-foreground-secondary" />
        {def ? (
          <>
            <ul className="flex flex-col gap-3" aria-label={`${doneGoals} / ${quest.goals.length}`}>
              {quest.goals.map((g) => <GoalRow key={g.stat} stats={stats} goal={g} />)}
            </ul>
            {claimed && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Text id="quests.card.moves" vars={{ count: def.moves.length }} className="text-muted-foreground tabular-nums" />
                <span aria-hidden className="text-muted-foreground">·</span>
                <span className="font-semibold text-foreground">{FORMS[def.id].title}</span>
              </div>
            )}
            <div className="mt-auto pt-2">
              {claimed ? (
                <Button asChild variant="outline" className="w-full"><Link to={`/?fighter=${def.id}`}><Text id="quests.card.fight" vars={{ name: def.name }} /></Link></Button>
              ) : (
                <Button className="w-full" disabled={!ready} onClick={() => claimQuest(quest.id) && onClaim(def)}>
                  <Text id={ready ? "quests.card.claim" : "quests.card.locked"} />
                </Button>
              )}
            </div>
          </>
        ) : (
          <Text id="quests.card.sealed" as="p" className="mt-auto text-sm text-muted-foreground" />
        )}
      </PanelBody>
    </Panel>
  );
}

export default function Quests() {
  const save = useQuests();
  const [unlocking, setUnlocking] = useState<FighterDef | null>(null);
  const close = useCallback(() => setUnlocking(null), []);
  return (
    <PageContainer>
      <TopBar />
      <PageHeader eyebrow={<Text id="quests.eyebrow" />} title={<Text id="quests.title" />} subtitle={<Text id="quests.subtitle" />} />
      <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" data-quest-list>
        {QUESTS.map((q, i) => (
          <li key={q.id}>
            <QuestCard quest={q} n={i + 1} stats={save.stats} claimed={save.claimed.includes(q.id)} onClaim={setUnlocking} />
          </li>
        ))}
      </ul>
      {unlocking && <UnlockCutscene def={unlocking} onClose={close} />}
    </PageContainer>
  );
}

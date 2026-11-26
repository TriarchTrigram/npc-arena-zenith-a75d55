import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/roster";
import { Text, useString } from "~stencil/ui/strings";
import type { StringKey } from "~stencil/types/strings";
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
import { cn } from "~/lib/utils";
import { DEF_BY_ID, FIGHTERS, NEWGEN_IDS, QUESTERS, defOf, isNewGen, type FighterDef, type Role } from "~/lib/fighters";
import { BOSSES, BOSS_PHASES, type BossId } from "~/lib/bosses";
import { allCleared, bossChapter, bossesBeaten, loadProgress } from "~/lib/story";
import { useDevMode } from "~/lib/dev-mode";
import { useDevUnlocks } from "~/lib/dev-unlocks";
import { QUESTS, useUnlocked } from "~/lib/quests";
import { FighterPortrait } from "~/components/quest-scenes";
import { FORMS, FORM_NAME, HYPER_FORM, PERFECTED_FLAME, formsOf, type Form, type FormKind } from "~/lib/forms";
import { useHybrids } from "~/lib/hybrids";
import { FusionSheet, HybridParents } from "~/components/fusion-sheet";
import { ProgressCodeSheet } from "~/components/progress-code-sheet";
import { DevModeSheet } from "~/components/dev-mode-sheet";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Fighters | NPC Arena" },
    { name: "description", content: "Meet the 16 fighters of NPC Arena and their powers." },
  ];
}

const ROLE_TONE: Record<Role, "neutral" | "info" | "success" | "warning" | "danger"> = {
  attacker: "danger",
  control: "info",
  tank: "warning",
  support: "success",
  trickster: "neutral",
};

const ROLES: Role[] = ["attacker", "control", "tank", "support", "trickster"];

type Fighter = FighterDef;

function TopBar() {
  const navLabel = useString("roster.navLabel");
  return (
    <nav aria-label={navLabel} className="mb-6 flex flex-wrap items-center gap-1 sm:gap-2 max-sm:[&>:not(:first-child)]:px-1.5">
      <Text id="common.appName" className="mr-auto font-display text-lg" />
      <Button asChild variant="ghost" size="sm">
        <Link to="/">
          <Text id="common.arena" />
        </Link>
      </Button>
      <Button asChild variant="secondary" size="sm">
        <Link to="/roster" aria-current="page">
          <Text id="common.fighters" />
        </Link>
      </Button>
      <Button asChild variant="ghost" size="sm">
        <Link to="/quests">
          <Text id="common.quests" />
        </Link>
      </Button>
      <ProgressCodeSheet />
      <DevModeSheet />
    </nav>
  );
}

function FighterCard({ fighter, index, quest = false, newgen = false }: { fighter: Fighter; index: number | null; quest?: boolean; newgen?: boolean }) {
  const boss = fighter.boss;
  const hybrid = !!fighter.parents;
  return (
    <Panel className="h-full">
      <PanelBody className="flex h-full flex-col gap-4">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-full border-4 border-foreground font-display text-xl text-foreground"
            style={{ background: hybrid ? `linear-gradient(90deg, ${fighter.color} 50%, ${fighter.glow} 50%)` : fighter.color }}
          >
            {fighter.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            {boss ? (
              <Text id="roster.card.boss" className="text-xs uppercase tracking-widest text-muted-foreground" />
            ) : newgen ? (
              <Text id="roster.card.newgen" className="text-xs uppercase tracking-widest text-muted-foreground" />
            ) : quest ? (
              <Text id="roster.card.quest" className="text-xs uppercase tracking-widest text-muted-foreground" />
            ) : index == null ? (
              <Text id="roster.card.hybrid" className="text-xs uppercase tracking-widest text-muted-foreground" />
            ) : (
              <Text
                id="roster.card.number"
                vars={{ n: index + 1 }}
                className="text-xs uppercase tracking-widest text-muted-foreground tabular-nums"
              />
            )}
            <h3 className="font-display text-xl text-foreground">{fighter.name}</h3>
            <HybridParents def={fighter} className="block text-sm text-muted-foreground" />
          </div>
          <StatusBadge tone={ROLE_TONE[fighter.role]}>
            <Text id={`roster.role.${fighter.role}` as StringKey} />
          </StatusBadge>
        </div>
        <div>
          <Text id="roster.card.power" as="p" className="text-xs uppercase tracking-widest text-muted-foreground" />
          <p className="text-foreground">{fighter.power}</p>
        </div>
        <div>
          <Text id="roster.card.ability" as="p" className="text-xs uppercase tracking-widest text-muted-foreground" />
          <p className="text-foreground-secondary">{fighter.ability}</p>
        </div>
        {boss
          ? (BOSS_PHASES[boss] ?? []).map((fm) => <FormBlock key={fm.title} form={fm} />)
          : !hybrid && formsOf(fighter.id).map((fm) => <FormBlock key={fm.kind} form={fm} />)}
        <div className="mt-auto border-t-2 border-border-subtle pt-4">
          <Text id="roster.card.moves" vars={{ count: fighter.moves.length }} as="p" className="text-xs uppercase tracking-widest text-muted-foreground tabular-nums" />
          <ul className="mt-2 flex flex-col gap-2">
            {fighter.moves.map((m) => (
              <li key={m.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className={cn("text-foreground", m.id.startsWith("mix-") ? "font-extrabold" : "font-semibold")}>{m.name}</span>
                <Text id={`roster.kind.${m.kind}` as StringKey} className="shrink-0 text-muted-foreground" />
              </li>
            ))}
          </ul>
        </div>
      </PanelBody>
    </Panel>
  );
}

const FORM_TONE: Record<FormKind, "neutral" | "info" | "success" | "warning" | "danger"> = {
  rage: "danger",
  perfected: "danger",
  awakened: "warning",
  mastery: "info",
  mystic: "success",
  nightmare: "danger",
  surge: "info",
  super: "warning",
  hyper: "neutral",
  phase: "danger",
};

/** A fighter's form: its mode, its own name, what it does and the moves it adds. */
function FormBlock({ form }: { form: Form }) {
  return (
    <div
      data-form-block
      className="rounded-md border-2 border-border-subtle p-3"
      style={{ borderLeftColor: form.a, borderLeftWidth: 6 }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={FORM_TONE[form.kind]}>{form.label ?? FORM_NAME[form.kind]}</StatusBadge>
        <span className="text-sm font-extrabold tracking-wide text-foreground">{form.title}</span>
      </div>
      <p className="mt-2 text-sm text-foreground-secondary">{form.blurb}</p>
      <Text id="roster.card.formAt" vars={{ at: Math.round(form.at * 100) }} as="p" className="mt-1 text-xs text-muted-foreground tabular-nums" />
      <ul className="mt-2 flex flex-col gap-1">
        {form.moves.map((m) => (
          <li key={m.id} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-extrabold text-foreground">{m.name}</span>
            <Text id={`roster.kind.${m.kind}` as StringKey} className="shrink-0 text-muted-foreground" />
          </li>
        ))}
      </ul>
    </div>
  );
}

const FORM_GROUPS: FormKind[] = ["rage", "awakened", "mastery", "mystic", "perfected", "nightmare", "surge", "super", "hyper"];

/** Who has which form, at a glance. */
function FormsOverview() {
  return (
    <section className="mt-8" data-forms-overview>
      <SectionHeading title={<Text id="roster.forms.title" />} />
      <Text id="roster.forms.subtitle" as="p" className="-mt-2 mb-6 max-w-prose text-foreground-secondary" />
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FORM_GROUPS.map((kind) => {
          const members = kind === "perfected" ? [PERFECTED_FLAME] : kind === "hyper" ? [HYPER_FORM] : [...FIGHTERS, ...QUESTERS].map((f) => FORMS[f.id]).filter((fm) => fm.kind === kind);
          return (
            <li key={kind}>
              <Panel className="h-full">
                <PanelBody className="flex h-full flex-col gap-3">
                  <StatusBadge tone={FORM_TONE[kind]}>{FORM_NAME[kind]}</StatusBadge>
                  <Text id={`roster.forms.${kind}` as StringKey} as="p" className="text-sm text-muted-foreground" />
                  <ul className="flex flex-col gap-2">
                    {members.map((fm) => (
                      <li key={fm.power + fm.kind} className="flex items-center gap-2 text-sm">
                        <span aria-hidden="true" className="size-3 shrink-0 rounded-full border-2 border-foreground" style={{ background: kind === "perfected" ? `linear-gradient(90deg, ${fm.a} 50%, ${fm.b} 50%)` : kind === "hyper" ? "conic-gradient(hsl(0 90% 65%), hsl(60 90% 65%), hsl(120 80% 60%), hsl(190 90% 65%), hsl(260 90% 70%), hsl(320 90% 70%), hsl(0 90% 65%))" : fm.a }} />
                        <span className="font-semibold text-foreground">{[...FIGHTERS, ...QUESTERS].find((f) => f.id === fm.power)?.name}</span>
                        <span className="ml-auto truncate text-xs text-muted-foreground">{fm.title}</span>
                      </li>
                    ))}
                  </ul>
                </PanelBody>
              </Panel>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function Roster() {
  const [role, setRole] = useState<Role | "all">("all");
  const shown = FIGHTERS.map((f, i) => ({ f, i })).filter(({ f }) => role === "all" || f.role === role);
  const hybridKeys = useHybrids();
  const hybrids = hybridKeys.map(defOf);
  const shownHybrids = hybrids.filter((f) => role === "all" || f.role === role);
  const unlocked = useUnlocked();
  const dev = useDevMode().on;
  const devUnlocks = useDevUnlocks();
  const earned = unlocked.filter((p) => !isNewGen(p));
  const youngEarned = unlocked.filter(isNewGen);
  // Story progress lives in this browser, so it is read after the first render
  const [beaten, setBeaten] = useState<BossId[]>([]);
  useEffect(
    () => setBeaten(bossesBeaten(dev ? allCleared() : loadProgress().cleared, dev ? [] : devUnlocks.bosses)),
    [dev, devUnlocks.bosses],
  );

  return (
    <PageContainer>
      <TopBar />
      <PageHeader
        eyebrow={<Text id="roster.eyebrow" />}
        title={<Text id="roster.title" />}
        subtitle={<Text id="roster.subtitle" />}
        actions={
          <Button asChild>
            <Link to="/">
              <Text id="roster.cta" />
            </Link>
          </Button>
        }
      />

      <FormsOverview />

      <div className="mt-12 flex flex-wrap items-center gap-2 py-1.5">
        <Text id="roster.filter.label" className="mr-2 text-sm text-muted-foreground" />
        <Button size="sm" variant={role === "all" ? "default" : "outline"} onClick={() => setRole("all")}>
          <Text id="roster.filter.all" />
        </Button>
        {ROLES.map((r) => (
          <Button
            key={r}
            size="sm"
            variant={role === r ? "default" : "outline"}
            onClick={() => setRole(r)}
            aria-pressed={role === r}
          >
            <Text id={`roster.role.${r}` as StringKey} />
          </Button>
        ))}
      </div>

      <div className="mt-6">
        <SectionHeading
          title={<Text id="roster.sectionAll" />}
          action={
            <Text id="roster.count" vars={{ count: shown.length }} className="text-sm text-muted-foreground tabular-nums" />
          }
        />
        {shown.length === 0 ? (
          <EmptyState
            title={<Text id="roster.empty.title" />}
            body={<Text id="roster.empty.body" />}
            action={
              <Button variant="outline" onClick={() => setRole("all")}>
                <Text id="roster.empty.action" />
              </Button>
            }
          />
        ) : (
          <ul className={cn("grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")}>
            {shown.map(({ f, i }) => (
              <li key={f.id}>
                <FighterCard fighter={f} index={i} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <section className="mt-12" data-roster-questers>
        <SectionHeading
          title={<Text id="roster.sectionQuest" />}
          action={<Text id="roster.questCount" vars={{ count: earned.length }} className="text-sm text-muted-foreground tabular-nums" />}
        />
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {QUESTERS.filter((q) => !isNewGen(q.id)).map((q) => (
            <li key={q.id}>
              {earned.includes(q.id) ? (
                <FighterCard fighter={q} index={null} quest />
              ) : (
                <Panel className="h-full overflow-hidden">
                  <div className="border-b-2 border-border-subtle bg-[hsl(250_32%_10%)]">
                    <FighterPortrait def={q} locked />
                  </div>
                  <PanelBody className="flex flex-col gap-3">
                    <Text id="roster.card.quest" className="text-xs uppercase tracking-widest text-muted-foreground" />
                    <Text id="roster.questLocked.title" as="h3" className="font-display text-xl text-foreground" />
                    <Text id="roster.questLocked.body" vars={{ name: q.name }} as="p" className="text-sm text-foreground-secondary" />
                    <Text id={`quests.list.${QUESTS.find((x) => x.reward === q.id)?.id ?? "fold"}.title` as StringKey} as="p" className="text-sm font-semibold text-foreground" />
                    <Button asChild variant="outline" size="sm" className="self-start">
                      <Link to="/quests"><Text id="roster.questLocked.action" /></Link>
                    </Button>
                  </PanelBody>
                </Panel>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" data-roster-newgen>
        <SectionHeading
          title={<Text id="roster.sectionNewGen" />}
          action={<Text id="roster.newGenCount" vars={{ count: youngEarned.length, total: NEWGEN_IDS.length }} className="text-sm text-muted-foreground tabular-nums" />}
        />
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {NEWGEN_IDS.map((id) => {
            const y = DEF_BY_ID[id];
            return (
              <li key={id}>
                {youngEarned.includes(id) ? (
                  <FighterCard fighter={y} index={null} newgen />
                ) : (
                  <Panel className="h-full overflow-hidden">
                    <div className="border-b-2 border-border-subtle bg-[hsl(250_32%_10%)]">
                      <FighterPortrait def={y} locked />
                    </div>
                    <PanelBody className="flex flex-col gap-3">
                      <Text id="roster.card.newgen" className="text-xs uppercase tracking-widest text-muted-foreground" />
                      <Text id="roster.newGenLocked.title" as="h3" className="font-display text-xl text-foreground" />
                      <Text id="roster.newGenLocked.body" vars={{ name: y.name }} as="p" className="text-sm text-foreground-secondary" />
                      <Button asChild variant="outline" size="sm" className="self-start">
                        <Link to="/"><Text id="roster.cta" /></Link>
                      </Button>
                    </PanelBody>
                  </Panel>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-12" data-roster-bosses>
        <SectionHeading
          title={<Text id="roster.sectionBosses" />}
          action={<Text id="roster.bossCount" vars={{ count: beaten.length }} className="text-sm text-muted-foreground tabular-nums" />}
        />
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(Object.keys(BOSSES) as BossId[]).map((id) => {
            const b = BOSSES[id];
            return (
              <li key={id}>
                {beaten.includes(id) ? (
                  <FighterCard fighter={b} index={null} />
                ) : (
                  <Panel className="h-full overflow-hidden">
                    <div className="border-b-2 border-border-subtle bg-[hsl(250_32%_10%)]">
                      <FighterPortrait def={b} locked />
                    </div>
                    <PanelBody className="flex flex-col gap-3">
                      <Text id="roster.card.boss" className="text-xs uppercase tracking-widest text-muted-foreground" />
                      <Text id="roster.bossLocked.title" as="h3" className="font-display text-xl text-foreground" />
                      <Text id={bossChapter(id).book > 1 ? "roster.bossLocked.bodyBook" : "roster.bossLocked.body"} vars={{ name: b.name, book: bossChapter(id).book, chapter: bossChapter(id).chapter }} as="p" className="text-sm text-foreground-secondary" />
                      <Button asChild variant="outline" size="sm" className="self-start">
                        <Link to="/"><Text id="roster.cta" /></Link>
                      </Button>
                    </PanelBody>
                  </Panel>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-12" data-roster-hybrids>
        <SectionHeading
          title={<Text id="roster.sectionHybrids" />}
          action={
            <div className="flex items-center gap-3">
              {hybrids.length > 0 && (
                <Text id="roster.hybridCount" vars={{ count: shownHybrids.length }} className="text-sm text-muted-foreground tabular-nums" />
              )}
              <FusionSheet saved={hybridKeys} />
            </div>
          }
        />
        {hybrids.length === 0 ? (
          <EmptyState title={<Text id="roster.hybridsEmpty.title" />} body={<Text id="roster.hybridsEmpty.body" />} />
        ) : shownHybrids.length === 0 ? (
          <Text id="roster.hybridsFiltered" as="p" className="text-sm text-muted-foreground" />
        ) : (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shownHybrids.map((f, k) => (
              <li key={hybridKeys[hybrids.indexOf(f)] ?? k}>
                <FighterCard fighter={f} index={null} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}

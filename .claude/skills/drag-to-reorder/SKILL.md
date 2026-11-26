---
name: drag-to-reorder
description: >
  Letting app users put items in their own order and keeping it — "drag to reorder", "sort these by hand", "move this up", "arrange the steps", "drag tasks between sections", a sortable list, an ordered checklist, modules and lessons, episodes, playlist items, a board whose columns keep their order. The platform ships the sortable list and the save helper; never wire drag events, a drag library or a reorder route by hand.
metadata:
  agents: [chat, builder]
---

# Drag to reorder

Three pieces ship with the platform, so a reorderable list is a screen like any
other and never a build spent on drag geometry or position maths:

- `<SortableList>` from `~stencil/ui/sortable/list` — one list, dragged by a handle with mouse or finger, or moved with the arrow keys on the handle; it announces each move to screen readers.
- `<SortableGroups>` from the same module — several titled lists in one drag space, so an item can also move between sections.
- `moveRow` and `nextPosition` from `~stencil/data` — the save side: one move writes one row, and the list comes back in its saved order.

## Never hand-roll

Do NOT add a drag library (`dnd-kit`, `react-beautiful-dnd`, `sortablejs`),
write `onDragStart`/`onDrop` handlers or pointer tracking, add move up / move
down buttons as the reorder control, rewrite every row's position after a drop,
or invent a `sort_order` scheme. Native HTML drag does not fire on phones and
a whole-list rewrite loses a second app user's move. An app that already
carries a hand-built reorder keeps working; replace it with these pieces only
when the app builder asks, or when the next change lands on that list anyway.

The `kanban-board.tsx` scaffold is an in-memory demo of cards moving between
columns and keeps nothing; use `<SortableGroups>` for any board whose order
must survive a reload.

## Data model

Add one `number` field named `position` to the entity with the entity tools
(`updateEntity`, action `add`, not required). That is the whole convention:
rows are listed by `position` ascending, then `createdAt`. Nothing else is
stored for the order, and the column is never required — a row without one
sorts first and the first move on its group renumbers it.

When items move between groups, the group is a column the row already has
(a `status`, a `sectionId`); the move writes that column too.

Set the position of a new row from `nextPosition`, so a new item lands at the
end instead of at the top:

```ts
import { data, nextPosition } from "~stencil/data";

const db = await data(request, context.cloudflare.env);
const tasks = db.from("tasks");
await tasks.create({ title, position: await nextPosition(tasks) });
```

## One list

The loader lists by position; the action applies the move; the component
reports it with a fetcher.

```tsx
import { useFetcher } from "react-router";
import { data, moveRow } from "~stencil/data";
import { SortableList } from "~stencil/ui/sortable/list";

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = await data(request, context.cloudflare.env);
  const steps = await db.from("steps").list({ orderBy: [["position", "asc"], ["createdAt", "asc"]] });
  return { steps };
}

export async function action({ request, context }: Route.ActionArgs) {
  const db = await data(request, context.cloudflare.env);
  const form = await request.formData();
  if (form.get("intent") === "move") {
    await moveRow(db.from("steps"), {
      id: String(form.get("id")),
      group: null,
      afterId: (form.get("afterId") as string) || null,
      beforeId: (form.get("beforeId") as string) || null,
    });
    return { ok: true };
  }
  return { ok: false };
}

export default function Steps({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher();
  return (
    <SortableList
      items={loaderData.steps}
      onMove={(move) =>
        fetcher.submit(
          { intent: "move", id: move.id, afterId: move.afterId ?? "", beforeId: move.beforeId ?? "" },
          { method: "post" },
        )
      }
      renderItem={(step) => <span>{step.title}</span>}
    />
  );
}
```

`onMove` fires once per drop or key move that changed the order, with the
moved id and its new neighbours (`afterId` / `beforeId`, null at an end). The
list shows the new order at once and takes the saved order back from `items`
when the loader revalidates after the action — so the action must not throw on
a good move, or the list snaps back. `moveRow` returns the group in its saved
order, which an action can return when the screen wants it without a reload.

The spoken name of an item comes from its `title` or `name`; pass `label` when
the row has neither. `handleLabel` names the grip for screen readers,
`emptyText` fills an empty list, and `className` / `itemClassName` restyle the
container and each row (the row's default is a bordered, rounded block).

## Lists with sections

```tsx
import { SortableGroups } from "~stencil/ui/sortable/list";

const groups = sections.map((s) => ({ id: s.id, title: s.name, items: tasks.filter((t) => t.sectionId === s.id) }));

<SortableGroups
  groups={groups}
  onMove={(move) => fetcher.submit({ intent: "move", id: move.id, group: move.group ?? "", afterId: move.afterId ?? "", beforeId: move.beforeId ?? "" }, { method: "post" })}
  renderItem={(task) => <span>{task.title}</span>}
/>
```

The action names the group column, and `move.group` is the value it writes:

```ts
await moveRow(db.from("tasks"), move, { groupColumn: "sectionId" });
```

Build `groups` in the order the sections should appear and give each group
every row that belongs to it, in position order. A group with no rows still
renders, with `emptyText`, so an item can be dragged into it. A board of
statuses is the same call with `groupColumn: "status"` and one group per
status value.

## What `moveRow` guarantees

- Every read and write goes through the caller's access rule: a row the app user may not see or change fails as `notFound`, never as a silent no-op.
- A move writes the moved row only — a value halfway between its two new neighbours — so two app users reordering at once do not undo each other.
- When the gap between neighbours is used up, or a neighbour has no position yet, the whole group is renumbered once with even gaps. That is the only multi-row write, and it is rare.
- It refuses, with `DataAccessError` code `invalid`, a move next to itself, a neighbour from another group, and a grouped move with no group — the sortable list never sends one, so an action can let these throw.

## Out of scope

A nested tree (items with children that move together), a grid dragged in two
dimensions, and dragging between two separate screens are not shipped. Say so
plainly and offer the list or the sections instead; never fall back to a
hand-built drag for them.

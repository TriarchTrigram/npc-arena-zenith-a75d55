import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { SortableMove } from "../../types/sortable";

export interface SortableGroup<T extends { id: string }> {
  id: string;
  /** Shown above the group's items and spoken when an item lands in it. */
  title?: string;
  items: T[];
}

interface SortableCoreProps<T extends { id: string }> {
  /** Called once per drop or key move that changed the order; save it with `moveRow`. */
  onMove: (move: SortableMove) => void;
  renderItem: (item: T) => ReactNode;
  /** The spoken name of an item. Defaults to its `title` or `name`, then its id. */
  label?: (item: T) => string;
  /** Accessible name of the handle. */
  handleLabel?: string;
  /** Shown inside a group with no items. */
  emptyText?: string;
  className?: string;
  groupClassName?: string;
  itemClassName?: string;
}

export interface SortableListProps<T extends { id: string }> extends SortableCoreProps<T> {
  /** The items in their current order. */
  items: T[];
}

export interface SortableGroupsProps<T extends { id: string }> extends SortableCoreProps<T> {
  /** The groups in display order, each with its items in order. */
  groups: SortableGroup<T>[];
}

type Drag = { id: string; x: number; y: number; dx: number; dy: number };
type Drop = { groupId: string; index: number };

const SINGLE = "__list";

function GripIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <circle cx="5.5" cy="3.5" r="1.3" />
      <circle cx="10.5" cy="3.5" r="1.3" />
      <circle cx="5.5" cy="8" r="1.3" />
      <circle cx="10.5" cy="8" r="1.3" />
      <circle cx="5.5" cy="12.5" r="1.3" />
      <circle cx="10.5" cy="12.5" r="1.3" />
    </svg>
  );
}

function defaultLabel(item: { id: string; title?: unknown; name?: unknown }): string {
  if (typeof item.title === "string" && item.title) return item.title;
  if (typeof item.name === "string" && item.name) return item.name;
  return item.id;
}

function orderKey<T extends { id: string }>(groups: SortableGroup<T>[]): string {
  return groups.map((g) => `${g.id}:${g.items.map((i) => i.id).join(",")}`).join("|");
}

/**
 * A list app users reorder by dragging a handle (mouse or finger) or with the arrow keys on it.
 * Each move is reported through `onMove` as the moved id and its new neighbours; the list shows
 * the new order at once and takes the saved order back from `items` when the loader revalidates.
 */
export function SortableList<T extends { id: string }>({ items, ...rest }: SortableListProps<T>) {
  return <Sortable groups={[{ id: SINGLE, items }]} grouped={false} {...rest} />;
}

/**
 * Several titled lists sharing one drag space: an item moves within its group with the up and
 * down keys or a vertical drag, and to a neighbouring group with the left and right keys or a
 * drag across. `onMove.group` is the id of the group the item landed in.
 */
export function SortableGroups<T extends { id: string }>({ groups, ...rest }: SortableGroupsProps<T>) {
  return <Sortable groups={groups} grouped {...rest} />;
}

function Sortable<T extends { id: string }>({
  groups,
  grouped,
  onMove,
  renderItem,
  label = defaultLabel,
  handleLabel = "Drag to reorder",
  emptyText = "Nothing here yet",
  className = "flex flex-col gap-6",
  groupClassName = "flex flex-col gap-2",
  itemClassName = "flex items-center gap-2 rounded-lg border border-border bg-background p-3",
}: SortableGroupsProps<T> & { grouped: boolean }) {
  const [order, setOrder] = useState(groups);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const [note, setNote] = useState("");
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const handleRefs = useRef(new Map<string, HTMLButtonElement>());
  const groupRefs = useRef(new Map<string, HTMLUListElement>());

  const key = orderKey(groups);
  useEffect(() => {
    setOrder(groups);
  }, [key]); // the props are the saved order; a new id sequence replaces the optimistic one

  function locate(id: string): { groupId: string; index: number; item: T } | null {
    for (const g of order) {
      const index = g.items.findIndex((i) => i.id === id);
      if (index >= 0) return { groupId: g.id, index, item: g.items[index] };
    }
    return null;
  }

  function commit(id: string, to: Drop) {
    const from = locate(id);
    if (!from) return;
    const next = order.map((g) => ({ ...g, items: g.items.filter((i) => i.id !== id) }));
    const target = next.find((g) => g.id === to.groupId);
    if (!target) return;
    const index = Math.max(0, Math.min(to.index, target.items.length));
    target.items.splice(index, 0, from.item);
    if (orderKey(next) === orderKey(order)) return;
    setOrder(next);
    onMove({
      id,
      group: grouped ? to.groupId : null,
      afterId: target.items[index - 1]?.id ?? null,
      beforeId: target.items[index + 1]?.id ?? null,
    });
    const where = grouped && target.title ? ` in ${target.title}` : "";
    setNote(`${label(from.item)} moved to position ${index + 1} of ${target.items.length}${where}`);
    requestAnimationFrame(() => handleRefs.current.get(id)?.focus());
  }

  /** Where the pointer would drop: the group under it and the slot between its items. */
  function dropAt(x: number, y: number, draggedId: string): Drop | null {
    let best: { groupId: string; distance: number } | null = null;
    for (const [groupId, el] of groupRefs.current) {
      const r = el.getBoundingClientRect();
      const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      const distance = inside ? 0 : Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
      if (!best || distance < best.distance) best = { groupId, distance };
    }
    if (!best) return null;
    const groupId = best.groupId;
    const group = order.find((g) => g.id === groupId);
    if (!group) return null;
    let index = 0;
    for (const item of group.items) {
      if (item.id === draggedId) continue;
      const r = itemRefs.current.get(item.id)?.getBoundingClientRect();
      if (r && y > r.top + r.height / 2) index += 1;
    }
    return { groupId: group.id, index };
  }

  function onPointerDown(e: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ id, x: e.clientX, y: e.clientY, dx: 0, dy: 0 });
    setDrop(dropAt(e.clientX, e.clientY, id));
  }

  function onPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    setDrag({ ...drag, dx: e.clientX - drag.x, dy: e.clientY - drag.y });
    setDrop(dropAt(e.clientX, e.clientY, drag.id));
  }

  function onPointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const target = dropAt(e.clientX, e.clientY, drag.id);
    setDrag(null);
    setDrop(null);
    if (target) commit(drag.id, target);
  }

  function onPointerCancel() {
    setDrag(null);
    setDrop(null);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, id: string) {
    const at = locate(id);
    if (!at) return;
    const gi = order.findIndex((g) => g.id === at.groupId);
    let to: Drop | null = null;
    if (e.key === "ArrowUp" && at.index > 0) to = { groupId: at.groupId, index: at.index - 1 };
    else if (e.key === "ArrowDown") to = { groupId: at.groupId, index: at.index + 1 };
    else if (grouped && e.key === "ArrowLeft" && gi > 0) to = { groupId: order[gi - 1].id, index: order[gi - 1].items.length };
    else if (grouped && e.key === "ArrowRight" && gi < order.length - 1)
      to = { groupId: order[gi + 1].id, index: order[gi + 1].items.length };
    if (!to) return;
    e.preventDefault();
    commit(id, to);
  }

  const indicator = <li aria-hidden="true" className="h-0.5 rounded bg-primary" />;

  return (
    <div className={className}>
      {order.map((group) => (
        <section key={group.id} className={groupClassName}>
          {grouped && group.title ? <h3 className="text-sm font-semibold text-muted-foreground">{group.title}</h3> : null}
          <ul
            ref={(el) => {
              if (el) groupRefs.current.set(group.id, el);
              else groupRefs.current.delete(group.id);
            }}
            className="flex min-h-12 flex-col gap-2"
          >
            {group.items.length === 0 && (!drop || drop.groupId !== group.id) ? (
              <li className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">{emptyText}</li>
            ) : null}
            {group.items.map((item, i) => {
              const dragging = drag?.id === item.id;
              const slot = drop && drop.groupId === group.id ? drop.index : -1;
              const before = group.items.slice(0, i).filter((x) => x.id !== drag?.id).length;
              return (
                <Fragment key={item.id}>
                  {slot === before && !dragging ? indicator : null}
                  <li
                    ref={(el) => {
                      if (el) itemRefs.current.set(item.id, el);
                      else itemRefs.current.delete(item.id);
                    }}
                    className={`${itemClassName} ${dragging ? "relative z-10 opacity-80 shadow-lg" : ""}`}
                    style={dragging && drag ? { transform: `translate(${drag.dx}px, ${drag.dy}px)` } : undefined}
                  >
                    <button
                      ref={(el) => {
                        if (el) handleRefs.current.set(item.id, el);
                        else handleRefs.current.delete(item.id);
                      }}
                      type="button"
                      aria-roledescription="sortable"
                      aria-label={`${handleLabel}: ${label(item)}`}
                      className="shrink-0 cursor-grab touch-none select-none rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary active:cursor-grabbing"
                      onPointerDown={(e) => onPointerDown(e, item.id)}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                      onPointerCancel={onPointerCancel}
                      onKeyDown={(e) => onKeyDown(e, item.id)}
                    >
                      <GripIcon />
                    </button>
                    <div className="min-w-0 flex-1">{renderItem(item)}</div>
                  </li>
                </Fragment>
              );
            })}
            {drop && drop.groupId === group.id && drop.index >= group.items.filter((x) => x.id !== drag?.id).length
              ? indicator
              : null}
          </ul>
        </section>
      ))}
      <div aria-live="polite" className="sr-only">
        {note}
      </div>
    </div>
  );
}

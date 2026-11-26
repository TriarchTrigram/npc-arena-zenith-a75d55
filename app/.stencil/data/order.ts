/**
 * Saved ordering for rows an app user drags into place: a `number` column (`position`
 * by default) listed ascending. A move writes the moved row only, with a value between
 * its neighbours; once that gap is used up the group is renumbered with even gaps.
 */
import type { SortableMove } from "../types/sortable";
import type { TableClient } from "./index";
import type { WhereValue } from "./request";
import type { RowOf, TableName, WriteOf } from "./tables";
import { DataAccessError } from "./types";

/** The spacing between positions on append and after a renumber. */
export const POSITION_GAP = 1024;

/** A row as this module reads it: the id, plus columns looked up by name. */
type OrderedRow = { id: string } & Record<string, unknown>;

export type OrderOptions = {
  /** The number column that holds the order. Default `position`. */
  column?: string;
  /** The column that names a row's group (a status, a section id). `move.group` is written to it. */
  groupColumn?: string;
};

function positionOf(row: OrderedRow, column: string): number | null {
  const value = row[column];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function groupWhere(opts: OrderOptions, group: string | null): Record<string, WhereValue> | undefined {
  if (!opts.groupColumn) return undefined;
  return { [opts.groupColumn]: group === null ? { op: "isNull" } : group };
}

/**
 * Apply one move from the sortable list and return the group in its saved order. The caller's
 * access rule applies to every read and write, so a row the app user may not see or change
 * fails as `notFound`.
 */
export async function moveRow<N extends TableName>(
  table: TableClient<N>,
  move: SortableMove,
  opts: OrderOptions = {},
): Promise<RowOf<N>[]> {
  const column = opts.column ?? "position";
  if (move.afterId === move.id || move.beforeId === move.id) {
    throw new DataAccessError("invalid", `A row cannot be placed next to itself (${move.id}).`);
  }
  if (opts.groupColumn && move.group === null) {
    throw new DataAccessError("invalid", `A move on "${opts.groupColumn}" must name the group the row landed in.`);
  }
  const where = groupWhere(opts, move.group);
  const orderBy: [string, "asc" | "desc"][] = [
    [column, "asc"],
    ["createdAt", "asc"],
  ];
  // Rows are read by column name here; the table's own row type is restored at the boundary.
  const row = (await table.get(move.id)) as OrderedRow;
  const after = move.afterId ? ((await table.get(move.afterId)) as OrderedRow) : null;
  const before = move.beforeId ? ((await table.get(move.beforeId)) as OrderedRow) : null;
  for (const neighbour of [after, before]) {
    if (neighbour && opts.groupColumn && neighbour[opts.groupColumn] !== move.group) {
      throw new DataAccessError("invalid", `Row ${neighbour.id} is not in group "${move.group}".`);
    }
  }

  const a = after ? positionOf(after, column) : null;
  const b = before ? positionOf(before, column) : null;
  let next: number | null;
  if ((after && a === null) || (before && b === null)) next = null;
  else if (a !== null && b !== null) next = a < b ? (a + b) / 2 : null;
  else if (a !== null) next = a + POSITION_GAP;
  else if (b !== null) next = b - POSITION_GAP;
  else next = POSITION_GAP;
  // A midpoint that rounds onto a neighbour means the gap is used up.
  if (next !== null && ((a !== null && next <= a) || (b !== null && next >= b))) next = null;

  const groupWrite = opts.groupColumn ? { [opts.groupColumn]: move.group } : {};
  if (next !== null) {
    await table.update(move.id, { ...groupWrite, [column]: next } as unknown as WriteOf<N>);
    return table.list({ where, orderBy });
  }

  const rows = ((await table.list({ where, orderBy })) as OrderedRow[]).filter((r) => r.id !== move.id);
  const at = move.afterId
    ? rows.findIndex((r) => r.id === move.afterId) + 1
    : move.beforeId
      ? Math.max(0, rows.findIndex((r) => r.id === move.beforeId))
      : 0;
  rows.splice(at, 0, row);
  for (const [i, r] of rows.entries()) {
    const write = r.id === move.id ? { ...groupWrite, [column]: (i + 1) * POSITION_GAP } : { [column]: (i + 1) * POSITION_GAP };
    await table.update(r.id, write as unknown as WriteOf<N>);
  }
  return table.list({ where, orderBy });
}

/**
 * The position for a new row at the end of its group: one gap past the highest saved
 * position, or the first gap when the group is empty.
 */
export async function nextPosition<N extends TableName>(
  table: TableClient<N>,
  group: string | null = null,
  opts: OrderOptions = {},
): Promise<number> {
  const column = opts.column ?? "position";
  const [last] = (await table.list({ where: groupWhere(opts, group), orderBy: [[column, "desc"]], limit: 1 })) as OrderedRow[];
  return (last ? (positionOf(last, column) ?? 0) : 0) + POSITION_GAP;
}

/**
 * One reorder, as the sortable list reports it and `moveRow` applies it: the item moved,
 * the group it now sits in (null for a single list), and its new neighbours (null at an end).
 */
export interface SortableMove {
  id: string;
  group: string | null;
  afterId: string | null;
  beforeId: string | null;
}

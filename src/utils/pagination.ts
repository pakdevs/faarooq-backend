export type Cursor = string | null

export interface Paginated<T> {
  items: T[]
  nextCursor: Cursor
}

export function buildPage<T>(items: T[], nextCursor: Cursor): Paginated<T> {
  return { items, nextCursor }
}

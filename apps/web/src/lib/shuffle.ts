/** 53-bit string hash (cyrb53): fast, well distributed, deterministic. */
function hash(value: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Shuffles items in an order that depends only on the seed and each item's key: the same
 * user always gets the same order, whatever order the items come in, and adding an item
 * doesn't reorder the others.
 */
export function stableShuffle<T>(items: readonly T[], key: (item: T) => string, seed: string): T[] {
  return items
    .map((item) => ({ item, rank: hash(`${seed}:${key(item)}`) }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ item }) => item);
}

export interface TextMatch {
  /** Character offset in the original, unnormalised text. */
  start: number;
  /** Exclusive end offset in the original, unnormalised text. */
  end: number;
}

export interface CollapsedText {
  /** Text with every whitespace run collapsed to a single space. */
  text: string;
  /** Map from an index in `text` to the matching index in the original. */
  map: number[];
}

const WHITESPACE = /\s/;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Collapse whitespace while keeping a map back to the original offsets. */
export function collapseWhitespace(raw: string): CollapsedText {
  let text = "";
  const map: number[] = [];
  let pendingSpace = false;

  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];
    if (WHITESPACE.test(character)) {
      if (text.length > 0) pendingSpace = true;
      continue;
    }
    if (pendingSpace) {
      text += " ";
      map.push(index);
      pendingSpace = false;
    }
    text += character;
    map.push(index);
  }

  return { text, map };
}

/** The same whitespace rules as the haystack, so queries match cleanly. */
export function normalizeQuery(query: string) {
  return query.replace(/\s+/g, " ").trim();
}

/**
 * Case-insensitive phrase matching across line and item breaks. Offsets point
 * into the original string so callers can map them to DOM text nodes.
 */
export function findTextMatches(raw: string, query: string): TextMatch[] {
  const needle = normalizeQuery(query);
  if (!needle) return [];

  const { text, map } = collapseWhitespace(raw);
  if (!text) return [];

  const pattern = new RegExp(escapeRegExp(needle), "gi");
  const matches: TextMatch[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    const start = map[match.index];
    const end = map[match.index + match[0].length - 1];
    if (start !== undefined && end !== undefined) {
      matches.push({ start, end: end + 1 });
    }
    if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
  }

  return matches;
}

/** A short excerpt around a match for the results list. */
export function makeSnippet(raw: string, start: number, end: number, radius = 52) {
  const from = Math.max(0, start - radius);
  const to = Math.min(raw.length, end + radius);
  const body = raw.slice(from, to).replace(/\s+/g, " ").trim();
  return `${from > 0 ? "…" : ""}${body}${to < raw.length ? "…" : ""}`;
}

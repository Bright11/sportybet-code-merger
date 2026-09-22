// lib/sportybet.ts

// ---------- Types ----------
export interface Selection {
  eventId: string;
  marketId: string;
  specifier: string; // e.g. "total=2.5", "" when not applicable
  outcomeId: string;
}

export interface Conflict {
  eventId: string;
  marketId: string;
  specifier: string;
  options: { outcomeId: string; fromCode: string }[];
}

export interface MergeResult {
  selections: Selection[];
  duplicatesRemoved: number;
  conflicts: Conflict[];
  sameEventWarnings: string[];
}

interface ClientConfig {
  country: string;
  baseUrl: string;
  maxSelections: number;
  timeoutMs: number;
}

// ---------- Endpoint-specific layer (VERIFY IN DEVTOOLS) ----------
interface ShareResponse {
  bizCode: number;
  message?: string;
  data?: {
    outcomes: Array<{
      eventId: string;
      markets: Array<{
        id: string;
        specifier?: string;
        outcomes: Array<{ id: string }>;
      }>;
    }>;
  };
}

interface CreateResponse {
  bizCode: number;
  message?: string;
  data?: { shareCode: string };
}

export const DEFAULT_CONFIG: ClientConfig = {
  country: "gh",
  baseUrl: "https://www.sportybet.com",
  maxSelections: 50, // confirm the real limit
  timeoutMs: 15_000,
};

export class SportyBetClient {
  constructor(private readonly cfg: ClientConfig = DEFAULT_CONFIG) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    try {
      const res = await fetch(`${this.cfg.baseUrl}/api/${this.cfg.country}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(init?.headers ?? {}),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async loadCode(code: string): Promise<Selection[]> {
    const body = await this.request<ShareResponse>(
      `/orders/share/${encodeURIComponent(code.trim())}`
    );
    if (body.bizCode !== 10000 || !body.data) {
      throw new Error(`Code ${code} failed: ${body.message ?? body.bizCode}`);
    }
    return body.data.outcomes.flatMap((ev) =>
      ev.markets.flatMap((m) =>
        m.outcomes.map((o) => ({
          eventId: ev.eventId,
          marketId: m.id,
          specifier: m.specifier ?? "",
          outcomeId: o.id,
        }))
      )
    );
  }

  async createCode(selections: Selection[]): Promise<string> {
    const body = await this.request<CreateResponse>("/orders/share", {
      method: "POST",
      body: JSON.stringify({ selections }),
    });
    if (body.bizCode !== 10000 || !body.data) {
      throw new Error(`Create failed: ${body.message ?? body.bizCode}`);
    }
    return body.data.shareCode;
  }
}

// ---------- Pure merge logic ----------
const marketKey = (s: Selection): string =>
  `${s.eventId}|${s.marketId}|${s.specifier}`;

export const conflictKey = (c: Conflict): string =>
  `${c.eventId}|${c.marketId}|${c.specifier}`;

export function mergeSelections(
  batches: { code: string; selections: Selection[] }[]
): MergeResult {
  const byMarket = new Map<string, { sel: Selection; code: string }[]>();

  for (const { code, selections } of batches) {
    for (const sel of selections) {
      const key = marketKey(sel);
      const bucket = byMarket.get(key) ?? [];
      bucket.push({ sel, code });
      byMarket.set(key, bucket);
    }
  }

  const merged: Selection[] = [];
  const conflicts: Conflict[] = [];
  let duplicatesRemoved = 0;

  for (const entries of byMarket.values()) {
    const distinct = new Map(entries.map((e) => [e.sel.outcomeId, e]));
    duplicatesRemoved += entries.length - distinct.size;

    if (distinct.size === 1) {
      merged.push(entries[0].sel);
    } else {
      const first = entries[0].sel;
      conflicts.push({
        eventId: first.eventId,
        marketId: first.marketId,
        specifier: first.specifier,
        options: [...distinct.values()].map((e) => ({
          outcomeId: e.sel.outcomeId,
          fromCode: e.code,
        })),
      });
    }
  }

  const marketsPerEvent = new Map<string, Set<string>>();
  for (const s of merged) {
    const set = marketsPerEvent.get(s.eventId) ?? new Set<string>();
    set.add(`${s.marketId}|${s.specifier}`);
    marketsPerEvent.set(s.eventId, set);
  }
  const sameEventWarnings = [...marketsPerEvent]
    .filter(([, set]) => set.size > 1)
    .map(([id]) => `Event ${id} has multiple markets; SportyBet may reject this in one multiple.`);

  return { selections: merged, duplicatesRemoved, conflicts, sameEventWarnings };
}

// ---------- Orchestration ----------
export async function previewMerge(codes: string[]): Promise<MergeResult> {
  const client = new SportyBetClient();
  const unique = [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  if (unique.length < 2) throw new Error("Provide at least two different codes.");

  const batches = await Promise.all(
    unique.map(async (code) => ({ code, selections: await client.loadCode(code) }))
  );
  return mergeSelections(batches);
}

export async function createMerged(
  preview: MergeResult,
  choices: Record<string, string> // conflictKey -> chosen outcomeId
): Promise<string> {
  const selections = [...preview.selections];

  for (const c of preview.conflicts) {
    const outcomeId = choices[conflictKey(c)];
    if (!outcomeId) throw new Error(`Unresolved conflict on event ${c.eventId}`);
    selections.push({
      eventId: c.eventId,
      marketId: c.marketId,
      specifier: c.specifier,
      outcomeId,
    });
  }

  if (selections.length > DEFAULT_CONFIG.maxSelections) {
    throw new Error(
      `Merged slip has ${selections.length} selections; limit is ${DEFAULT_CONFIG.maxSelections}.`
    );
  }
  return new SportyBetClient().createCode(selections);
}
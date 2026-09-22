// app/page.tsx
"use client";
import { useState } from "react";

interface Conflict {
  eventId: string;
  marketId: string;
  specifier: string;
  options: { outcomeId: string; fromCode: string }[];
}

interface DroppedSelection {
  eventId: string;
  marketId: string;
  specifier: string;
  outcomeId: string;
}

interface VerifyResult {
  ok: boolean;
  submittedCount: number;
  returnedCount: number;
  missing: DroppedSelection[];
  extra: DroppedSelection[];
}

interface ApiResponse {
  status: "ok" | "conflicts" | "error" | "mismatch";
  code?: string;
  message?: string;
  conflicts?: Conflict[];
  duplicatesRemoved?: number;
  sameEventWarnings?: string[];
  verification?: VerifyResult;
  overlapDropped?: DroppedSelection[];
}

const keyOf = (c: Conflict) => `${c.eventId}|${c.marketId}|${c.specifier}`;

export default function Page() {
  const [input, setInput] = useState("");
  const [res, setRes] = useState<ApiResponse | null>(null);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function submit(withChoices?: Record<string, string>) {
    setLoading(true);
    const codes = input.split(/[\s,]+/).filter(Boolean);
    const r = await fetch("/api/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codes, choices: withChoices }),
    });
    setRes((await r.json()) as ApiResponse);
    setLoading(false);
  }

  const allChosen = res?.conflicts?.every((c) => choices[keyOf(c)]) ?? false;

  return (
    <main className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-bold">Merge booking codes</h1>
      <textarea
        className="w-full rounded border p-2"
        rows={3}
        placeholder="CT1YPP ELYDM2 ..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <button
        className="rounded bg-blue-400 px-4 py-2 text-white disabled:opacity-50 w-full cursor-pointer"
        disabled={loading}
        onClick={() => submit()}
      >
        {loading ? "Working..." : "Merge"}
      </button>

      {res?.status === "error" && <p className="text-red-600">{res.message}</p>}

      {res?.status === "conflicts" && (
        <div className="space-y-3">
          <p className="font-medium">Same match and market, different picks. Choose one:</p>
          {res.conflicts!.map((c) => (
            <fieldset key={keyOf(c)} className="rounded border p-2">
              <legend className="text-sm">Event {c.eventId} / market {c.marketId} {c.specifier}</legend>
              {c.options.map((o) => (
                <label key={o.outcomeId} className="block">
                  <input
                    type="radio"
                    name={keyOf(c)}
                    onChange={() => setChoices((p) => ({ ...p, [keyOf(c)]: o.outcomeId }))}
                  />{" "}
                  Outcome {o.outcomeId} (from {o.fromCode})
                </label>
              ))}
            </fieldset>
          ))}
          <button
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
            disabled={!allChosen || loading}
            onClick={() => submit(choices)}
          >
            Create merged code
          </button>
        </div>
      )}

      {res && (res.status === "ok" || res.status === "mismatch") && (
        <div className="rounded border p-3">
          <p className="text-2xl font-mono font-bold">{res.code}</p>
          <p className="text-sm">Duplicates removed: {res.duplicatesRemoved}</p>

          {res.overlapDropped && res.overlapDropped.length > 0 && (
            <div className="mt-2 rounded border border-amber-400 bg-amber-50 p-2 text-sm">
              <p className="font-semibold text-amber-700">
                Dropped {res.overlapDropped.length} selection(s) to avoid multiple markets on the same event:
              </p>
              {res.overlapDropped.map((s, i) => (
                <p key={i}>
                  Event {s.eventId}: market {s.marketId} {s.specifier}, outcome {s.outcomeId}
                </p>
              ))}
            </div>
          )}

          {res.status === "mismatch" && res.verification && (
            <div className="mt-2 rounded border border-red-400 bg-red-50 p-2 text-sm">
              <p className="font-semibold text-red-700">
                SportyBet returned {res.verification.returnedCount} selections, you submitted{" "}
                {res.verification.submittedCount}. Verify before placing this bet.
              </p>
              {res.verification.missing.map((s, i) => (
                <p key={`m${i}`}>Dropped: event {s.eventId}, market {s.marketId} {s.specifier}</p>
              ))}
              {res.verification.extra.map((s, i) => (
                <p key={`e${i}`}>Unexpected addition: event {s.eventId}, market {s.marketId} {s.specifier}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
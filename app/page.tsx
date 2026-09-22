// app/page.tsx
"use client";
import { useState } from "react";

interface Conflict {
  eventId: string;
  marketId: string;
  specifier: string;
  options: { outcomeId: string; fromCode: string }[];
}
interface ApiResponse {
  status: "ok" | "conflicts" | "error";
  code?: string;
  message?: string;
  conflicts?: Conflict[];
  duplicatesRemoved?: number;
  sameEventWarnings?: string[];
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
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
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

      {res?.status === "ok" && (
        <div className="rounded border p-3">
          <p className="text-2xl font-mono font-bold">{res.code}</p>
          <p className="text-sm">Duplicates removed: {res.duplicatesRemoved}</p>
          {res.sameEventWarnings?.map((w) => <p key={w} className="text-sm text-amber-600">{w}</p>)}
        </div>
      )}
    </main>
  );
}
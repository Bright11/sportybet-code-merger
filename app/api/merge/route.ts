// app/api/merge/route.ts
import { NextResponse } from "next/server";
import { previewMerge, createMerged } from "@/lib/sportybet";

export const runtime = "nodejs";

interface MergeRequest {
  codes: string[];
  choices?: Record<string, string>;
}

export async function POST(req: Request) {
  try {
    const { codes, choices } = (await req.json()) as MergeRequest;
    const preview = await previewMerge(codes);

    // Stop and ask the user if any conflicts are unresolved
    const needsChoice = preview.conflicts.length > 0 && !choices;
    if (needsChoice) {
      return NextResponse.json({ status: "conflicts", ...preview });
    }

    const code = await createMerged(preview, choices ?? {});
    return NextResponse.json({ status: "ok", code, ...preview });
  } catch (e) {
    return NextResponse.json(
      { status: "error", message: (e as Error).message },
      { status: 400 }
    );
  }
}
// app/api/merge/route.ts
import { NextResponse } from "next/server";
import { previewMerge, createAndVerify } from "@/lib/sportybet";

export const runtime = "nodejs";

interface MergeRequest {
  codes: string[];
  choices?: Record<string, string>;
}

export async function POST(req: Request) {
  try {
    const { codes, choices } = (await req.json()) as MergeRequest;
    const preview = await previewMerge(codes);

    const needsChoice = preview.conflicts.length > 0 && !choices;
    if (needsChoice) {
      return NextResponse.json({ status: "conflicts", ...preview });
    }

    const { code, verification, overlapDropped } = await createAndVerify(preview, choices ?? {});

    if (!verification.ok) {
      return NextResponse.json({
        status: "mismatch",
        code,
        verification,
        overlapDropped,
        ...preview,
      });
    }

    return NextResponse.json({ status: "ok", code, verification, overlapDropped, ...preview });
  } catch (e) {
    return NextResponse.json(
      { status: "error", message: (e as Error).message },
      { status: 400 }
    );
  }
}
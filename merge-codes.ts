// merge-codes.ts (standalone CLI)
import { previewMerge, createAndVerify, conflictKey } from "./lib/sportybet";

async function main() {
  const codes = process.argv.slice(2);
  if (codes.length < 2) {
    console.error("Usage: npx tsx merge-codes.ts CODE1 CODE2 [...]");
    process.exit(1);
  }

  const preview = await previewMerge(codes);

  if (preview.conflicts.length > 0) {
    console.warn(`${preview.conflicts.length} conflict(s) found. Defaulting to the first code's pick for each:`);
    const choices: Record<string, string> = {};
    for (const c of preview.conflicts) {
      const pick = c.options[0];
      choices[conflictKey(c)] = pick.outcomeId;
      console.warn(
        `  Event ${c.eventId} / market ${c.marketId} ${c.specifier}: using outcome ${pick.outcomeId} (from ${pick.fromCode})`
      );
    }
    const { code, verification } = await createAndVerify(preview, choices);
    printResult(code, preview, verification);
    return;
  }

  const { code, verification } = await createAndVerify(preview, {});
  printResult(code, preview, verification);
}

function printResult(
  code: string,
  preview: Awaited<ReturnType<typeof previewMerge>>,
  verification: Awaited<ReturnType<typeof createAndVerify>>["verification"]
) {
  console.log(`New code: ${code}`);
  console.log(`Selections submitted: ${verification.submittedCount}`);
  console.log(`Selections returned: ${verification.returnedCount}`);
  console.log(`Duplicates removed: ${preview.duplicatesRemoved}`);
  preview.sameEventWarnings.forEach((w) => console.warn(w));

  if (!verification.ok) {
    console.error("\n⚠ MISMATCH — the created code does not match what was submitted:");
    verification.missing.forEach((s) =>
      console.error(`  Dropped: event ${s.eventId}, market ${s.marketId} ${s.specifier}, outcome ${s.outcomeId}`)
    );
    verification.extra.forEach((s) =>
      console.error(`  Unexpected: event ${s.eventId}, market ${s.marketId} ${s.specifier}, outcome ${s.outcomeId}`)
    );
    process.exitCode = 1;
  } else {
    console.log("Verified: submitted selections match the created code.");
  }
}

main().catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});
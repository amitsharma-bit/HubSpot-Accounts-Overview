import { NextResponse } from "next/server";
import { performForcedRefresh } from "@/lib/forceRefresh";
import { getJSON, setJSON } from "@/lib/redis";

export const maxDuration = 290;

// The dashboard's own "Refresh" button. Unlike /api/refresh (the hourly
// cron's target), this has no secret to check — a secret can't be shipped to
// the browser safely. A short server-side cooldown is the actual protection
// against someone mashing the button and burning the ~380-call HubSpot sweep
// repeatedly; if Redis (where the cooldown timestamp lives) is unreachable,
// this fails OPEN (allows the refresh) rather than blocking a legitimate
// manual refresh just because the cooldown check itself couldn't run.
const COOLDOWN_MS = 5 * 60 * 1000;
const COOLDOWN_KEY = "refresh-now:last-triggered-at";

export async function POST() {
  try {
    const lastTriggeredAt = await getJSON<number>(COOLDOWN_KEY);
    if (lastTriggeredAt) {
      const elapsed = Date.now() - lastTriggeredAt;
      if (elapsed < COOLDOWN_MS) {
        const waitSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        return NextResponse.json({ error: `The dashboard was just refreshed — please wait ${waitSeconds}s before refreshing again.` }, { status: 429 });
      }
    }
  } catch (err) {
    console.error("[refresh-now] cooldown check unavailable, allowing refresh:", err);
  }

  const result = await performForcedRefresh();
  await setJSON(COOLDOWN_KEY, Date.now()).catch((err) => console.error("[refresh-now] failed to record cooldown:", err));

  return NextResponse.json({ ok: true, ...result });
}

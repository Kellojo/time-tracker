import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireUserIdWithApiKey } from "$lib/server/auth";
import { getMonthOfficeDays } from "$lib/server/db";

const MONTH_RE = /^\d{4}-\d{2}$/;

export const GET: RequestHandler = async (event) => {
  const userId = await requireUserIdWithApiKey(event, "hours:read");
  const month = event.url.searchParams.get("month");

  if (!month || !MONTH_RE.test(month)) {
    return json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "Expected query param month in YYYY-MM format.",
        },
      },
      { status: 400 },
    );
  }

  return json({
    data: {
      month,
      officeDays: getMonthOfficeDays(userId, month),
    },
    error: null,
  });
};
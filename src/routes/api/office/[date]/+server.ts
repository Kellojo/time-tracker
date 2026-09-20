import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireUserIdWithApiKey } from "$lib/server/auth";
import { setOfficeDay, removeOfficeDay } from "$lib/server/db";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const PUT: RequestHandler = async (event) => {
  const userId = await requireUserIdWithApiKey(event, "office:write");
  const day = event.params.date;

  if (!DAY_RE.test(day)) {
    return json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "Date must be in YYYY-MM-DD format.",
        },
      },
      { status: 400 },
    );
  }

  setOfficeDay(userId, day);

  return json({
    data: { day, officeDay: true },
    error: null,
  });
};

export const DELETE: RequestHandler = async (event) => {
  const userId = await requireUserIdWithApiKey(event, "office:write");
  const day = event.params.date;

  if (!DAY_RE.test(day)) {
    return json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "Date must be in YYYY-MM-DD format.",
        },
      },
      { status: 400 },
    );
  }

  removeOfficeDay(userId, day);

  return json({
    data: { day, officeDay: false },
    error: null,
  });
};
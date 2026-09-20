import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { randomBytes, randomUUID } from "node:crypto";
import { hashApiKey, requireUserId } from "$lib/server/auth";
import { createApiKey, listApiKeys } from "$lib/server/db";

const ALLOWED_SCOPES = ["timer:start", "timer:stop", "hours:read", "office:write"] as const;

type AllowedScope = (typeof ALLOWED_SCOPES)[number];

function defaultKeyName() {
  return `API Key ${new Date().toISOString()}`;
}

function generateApiKey() {
  return `ttk_${randomBytes(32).toString("hex")}`;
}

export const GET: RequestHandler = async (event) => {
  const userId = await requireUserId(event);

  return json({
    data: {
      keys: listApiKeys(userId),
    },
    error: null,
  });
};

export const POST: RequestHandler = async (event) => {
  const userId = await requireUserId(event);
  const body = await event.request.json().catch(() => ({}));

  const name =
    typeof body?.name === "string" && body.name.trim()
      ? body.name.trim()
      : defaultKeyName();
  const rawScopes: unknown[] = Array.isArray(body?.scopes)
    ? body.scopes
    : [...ALLOWED_SCOPES];
  const scopes = rawScopes.filter(
    (scope: unknown): scope is AllowedScope =>
      typeof scope === "string" &&
      ALLOWED_SCOPES.includes(scope as AllowedScope),
  );

  if (scopes.length === 0) {
    return json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "At least one valid scope is required.",
        },
      },
      { status: 400 },
    );
  }

  const apiKey = generateApiKey();

  createApiKey({
    id: randomUUID(),
    userId,
    name,
    keyHash: hashApiKey(apiKey),
    scopes,
  });

  return json(
    {
      data: {
        apiKey,
        name,
        scopes,
      },
      error: null,
    },
    { status: 201 },
  );
};

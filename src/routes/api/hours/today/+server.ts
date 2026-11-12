import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserIdWithApiKey } from '$lib/server/auth';
import { getDaySummary } from '$lib/server/tracker';
import { todayIso } from '$lib/time';

export const GET: RequestHandler = async (event) => {
	const userId = await requireUserIdWithApiKey(event, 'hours:read');
	return json({ data: getDaySummary(userId, todayIso()), error: null });
};

import { json, type RequestHandler } from '@sveltejs/kit';
import { requireUserIdWithApiKey } from '$lib/server/auth';
import { getWeekSummary } from '$lib/server/tracker';

export const GET: RequestHandler = async (event) => {
	const userId = await requireUserIdWithApiKey(event, 'hours:read');
	return json({ data: getWeekSummary(userId), error: null });
};

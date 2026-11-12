import { json, type RequestHandler } from '@sveltejs/kit';
import { requireUserIdWithApiKey } from '$lib/server/auth';
import { getYearSummary } from '$lib/server/tracker';

export const GET: RequestHandler = async (event) => {
	const userId = await requireUserIdWithApiKey(event, 'hours:read');
	const yearParam = event.url.searchParams.get('year');
	const year = yearParam ? Number(yearParam) : new Date().getFullYear();

	if (!Number.isInteger(year) || year < 2000 || year > 2100) {
		return json(
			{
				data: null,
				error: {
					code: 'VALIDATION_ERROR',
					message: 'Expected query param year as a valid year number.'
				}
			},
			{ status: 400 }
		);
	}

	return json({ data: getYearSummary(userId, year), error: null });
};

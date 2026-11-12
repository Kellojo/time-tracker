import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserIdWithApiKey } from '$lib/server/auth';
import { MONTH_RE } from '$lib/time';
import { getMonthTotals } from '$lib/server/db';

export const GET: RequestHandler = async (event) => {
	const userId = await requireUserIdWithApiKey(event, 'hours:read');
	const month = event.url.searchParams.get('month');

	if (!month || !MONTH_RE.test(month)) {
		return json(
			{
				data: null,
				error: {
					code: 'VALIDATION_ERROR',
					message: 'Expected query param month in YYYY-MM format.'
				}
			},
			{ status: 400 }
		);
	}

	return json({
		data: {
			month,
			days: getMonthTotals(userId, month)
		},
		error: null
	});
};

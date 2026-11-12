import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	const user = locals.session?.user;
	return {
		user: user
			? { name: user.name ?? null, email: user.email ?? null, image: user.image ?? null }
			: null
	};
};

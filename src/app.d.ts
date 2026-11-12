type AppSession = {
	user: {
		id: string;
		email?: string | null;
		name?: string | null;
		image?: string | null;
	};
} | null;

declare global {
	/** package.json version, injected by Vite. */
	const __VERSION__: string | undefined;

	namespace App {
		interface Locals {
			session: AppSession;
		}
	}
}

export {};

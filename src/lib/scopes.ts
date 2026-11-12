/**
 * Permissions an API key or an OAuth access token can carry. The same keys are used as the
 * permission keys of the Pocket ID custom API that protects the MCP endpoint.
 */
export const SCOPES = [
	{
		key: 'hours:read',
		label: 'Read hours',
		description: 'Read tracked time, timer status and office days.'
	},
	{ key: 'hours:write', label: 'Edit hours', description: 'Set the tracked total of a day.' },
	{ key: 'timer:start', label: 'Start timer', description: 'Start the live timer.' },
	{ key: 'timer:stop', label: 'Stop timer', description: 'Stop the live timer and book its time.' },
	{ key: 'office:write', label: 'Office days', description: 'Mark or unmark office days.' }
] as const;

export type Scope = (typeof SCOPES)[number]['key'];

export const ALL_SCOPES: Scope[] = SCOPES.map((scope) => scope.key);

export function isScope(value: unknown): value is Scope {
	return typeof value === 'string' && (ALL_SCOPES as string[]).includes(value);
}

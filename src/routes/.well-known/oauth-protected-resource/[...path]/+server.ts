import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { oidcConfig } from '$lib/server/better-auth';
import { MCP_PATH, mcpOAuthEnabled, mcpResourceUri } from '$lib/server/oauth';
import { ALL_SCOPES } from '$lib/scopes';

/**
 * RFC 9728 protected resource metadata for the MCP endpoint, served both at the path-suffixed
 * location (`/.well-known/oauth-protected-resource/mcp`) and at the root.
 */
export const GET: RequestHandler = ({ params }) => {
	const path = params.path ? `/${params.path}` : '';
	if (!mcpOAuthEnabled || !oidcConfig || (path && path !== MCP_PATH)) error(404, 'Not found');

	return json(
		{
			resource: mcpResourceUri,
			authorization_servers: [oidcConfig.issuer],
			// offline_access lets clients get a refresh token.
			scopes_supported: [...ALL_SCOPES, 'offline_access'],
			bearer_methods_supported: ['header'],
			resource_name: 'Time Tracker'
		},
		{ headers: { 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=300' } }
	);
};

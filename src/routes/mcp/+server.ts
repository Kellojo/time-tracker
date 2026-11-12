import type { RequestHandler } from './$types';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { resolvePrincipal } from '$lib/server/auth';
import { createMcpServer } from '$lib/server/mcp';
import { mcpOAuthEnabled, mcpResourceMetadataUrl } from '$lib/server/oauth';

const CORS_HEADERS = {
	'access-control-allow-origin': '*',
	'access-control-allow-methods': 'POST, GET, DELETE, OPTIONS',
	'access-control-allow-headers':
		'authorization, content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id',
	'access-control-expose-headers': 'www-authenticate, mcp-session-id'
};

function withCors(response: Response) {
	const headers = new Headers(response.headers);
	for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}

function jsonRpcError(status: number, message: string, headers: Record<string, string> = {}) {
	return withCors(
		new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32001, message }, id: null }), {
			status,
			headers: { 'content-type': 'application/json', ...headers }
		})
	);
}

/** RFC 6750 / RFC 9728 challenge pointing clients at the protected resource metadata. */
function challenge(error?: string, description?: string) {
	const params = [
		mcpOAuthEnabled ? `resource_metadata="${mcpResourceMetadataUrl}"` : 'realm="time-tracker"'
	];
	if (error) params.push(`error="${error}"`);
	if (description) params.push(`error_description="${description.replace(/"/g, "'")}"`);
	return `Bearer ${params.join(', ')}`;
}

const handle: RequestHandler = async (event) => {
	const auth = await resolvePrincipal(event);
	if (!auth.ok) {
		const hasToken = event.request.headers.has('authorization');
		// A 403 here means a valid token for a user that never signed in to the web app; that is
		// not fixable by re-authorizing, so it carries no OAuth error code.
		const error = auth.status === 401 && hasToken ? 'invalid_token' : undefined;
		return jsonRpcError(auth.status, auth.message, {
			'www-authenticate': challenge(error, hasToken ? auth.message : undefined)
		});
	}

	// Stateless server: every request is self-contained, so there is no stream to resume.
	if (event.request.method !== 'POST') {
		return jsonRpcError(405, 'Method not allowed.', { allow: 'POST, OPTIONS' });
	}

	const server = createMcpServer(auth.principal);
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true
	});
	await server.connect(transport);
	try {
		return withCors(await transport.handleRequest(event.request));
	} finally {
		void server.close();
	}
};

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
export const OPTIONS: RequestHandler = () => withCors(new Response(null, { status: 204 }));

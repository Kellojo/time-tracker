/** Calls one of the app's JSON endpoints (`{ data, error }` envelopes) and unwraps `data`. */
export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
	const { json, ...rest } = init ?? {};
	const res = await fetch(url, {
		...rest,
		headers:
			json === undefined ? rest.headers : { 'content-type': 'application/json', ...rest.headers },
		body: json === undefined ? rest.body : JSON.stringify(json)
	});
	const payload = await res.json().catch(() => null);
	if (!res.ok || !payload || payload.error) {
		throw new Error(
			payload?.error?.message ?? payload?.message ?? `Request failed (${res.status}).`
		);
	}
	return payload.data as T;
}

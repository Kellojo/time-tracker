<script lang="ts">
	import { page } from '$app/state';
	import { onMount, tick } from 'svelte';
	import LoaderIcon from '@lucide/svelte/icons/loader-2';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import { Button } from '$lib/components/ui/button/index.js';
	import CopyButton from '$lib/components/app/CopyButton.svelte';

	type Status = 'redirecting' | 'slow' | 'error';
	/** What failed: the browser is offline, this server is unreachable, or the server answered with an error. */
	type Failure = 'offline' | 'unreachable' | 'server';

	let status = $state<Status>('redirecting');
	let failure = $state<Failure>('server');
	let errorDetail = $state('');
	/** A retry is running; the retry button stays mounted (and focused) meanwhile. */
	let retrying = $state(false);
	let retryButton = $state<HTMLButtonElement | null>(null);
	let slowTimer: ReturnType<typeof setTimeout> | undefined;
	let controller: AbortController | undefined;

	const FAILURE_COPY: Record<Failure, string> = {
		offline: 'You’re offline. This page tries again as soon as you’re back online.',
		unreachable: 'Couldn’t reach Time Tracker. Check that the server is running, then try again.',
		server:
			'Something went wrong while contacting your identity provider. Try again, or check the server logs.'
	};

	/** Only same-origin paths, so the callback can't bounce the user to another site. */
	function safeCallback() {
		const value = page.url.searchParams.get('callbackUrl') || '/';
		return value.startsWith('/') && !value.startsWith('//') ? value : '/';
	}

	async function signIn() {
		// A retry replaces any attempt still in flight, so only one can settle.
		controller?.abort();
		const attempt = new AbortController();
		controller = attempt;

		// First attempt shows the redirecting state; retries keep the current screen and its focus.
		const isRetry = status !== 'redirecting' || retrying;
		if (isRetry) retrying = true;
		else status = 'redirecting';

		clearTimeout(slowTimer);
		// If the provider takes long to answer, offer a way out instead of spinning forever.
		slowTimer = setTimeout(() => {
			if (status === 'redirecting') status = 'slow';
			retrying = false;
		}, 6000);

		try {
			const res = await fetch('/api/auth/sign-in/oauth2', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ providerId: 'oidc', callbackURL: safeCallback() }),
				signal: attempt.signal
			});
			const payload = await res.json().catch(() => null);
			if (!res.ok || !payload?.url) {
				failure = 'server';
				throw new Error(
					payload?.message || payload?.error || `Server responded with status ${res.status}.`
				);
			}
			window.location.href = payload.url;
		} catch (err) {
			if (attempt.signal.aborted) return;
			clearTimeout(slowTimer);
			// fetch rejects with a TypeError when the request never got an answer from this server.
			if (err instanceof TypeError) failure = navigator.onLine ? 'unreachable' : 'offline';
			errorDetail = err instanceof Error ? err.message : String(err);
			const wasError = status === 'error';
			status = 'error';
			retrying = false;
			if (!wasError) {
				await tick();
				retryButton?.focus();
			}
		}
	}

	onMount(() => {
		void signIn();
		// Offline failures recover on their own once the connection is back.
		const onOnline = () => {
			if (status === 'error' && failure === 'offline') void signIn();
		};
		window.addEventListener('online', onOnline);
		return () => {
			clearTimeout(slowTimer);
			controller?.abort();
			window.removeEventListener('online', onOnline);
		};
	});
</script>

<svelte:head>
	<title>{status === 'error' ? 'Sign-in failed' : 'Sign in'} · Time Tracker</title>
	<noscript>
		<style>
			.js-only {
				display: none !important;
			}
		</style>
	</noscript>
</svelte:head>

<!-- Anchored from the top (not centred) so the brand mark stays put while the state below changes. -->
<main class="flex min-h-dvh justify-center px-4 pt-[max(4rem,24dvh)] pb-10">
	<div class="flex w-full max-w-sm flex-col items-center gap-5 text-center">
		<img
			src="/favicon.svg"
			alt=""
			class="size-12 rounded-2xl shadow-md dark:ring-1 dark:ring-white/10"
		/>
		<h1 class="text-xl font-semibold tracking-tight">Time Tracker</h1>

		{#if status === 'error'}
			<div class="-mt-3 flex w-full flex-col items-center gap-5">
				<div class="flex flex-col gap-1.5" role="alert">
					<h2 class="text-sm font-medium">Couldn’t start sign-in</h2>
					<p class="text-sm text-pretty text-muted-foreground">{FAILURE_COPY[failure]}</p>
				</div>
				{#if failure === 'server' && errorDetail}
					<div
						class="flex w-full items-start gap-2 rounded-xl bg-muted py-1.5 pr-1.5 pl-3 text-left"
					>
						<CircleAlertIcon class="mt-1.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
						<p class="min-w-0 flex-1 py-1 font-mono text-xs break-words text-foreground/80">
							{errorDetail}
						</p>
						<CopyButton value={errorDetail} label="Copy error" size="icon-sm" />
					</div>
				{/if}
				<Button
					bind:ref={retryButton}
					class="w-full"
					onclick={signIn}
					disabled={retrying}
					aria-busy={retrying}
				>
					{#if retrying}
						<LoaderIcon class="animate-spin motion-reduce:animate-none" />Retrying…
					{:else}
						<RotateCcwIcon />Try again
					{/if}
				</Button>
			</div>
		{:else}
			<div class="js-only -mt-3 flex flex-col items-center gap-4">
				<p
					class="flex items-center gap-2 text-sm text-muted-foreground motion-reduce:animate-pulse"
					role="status"
				>
					<LoaderIcon class="size-4 animate-spin motion-reduce:hidden" aria-hidden="true" />
					{status === 'slow'
						? 'Still waiting for your identity provider…'
						: 'Redirecting you to sign in…'}
				</p>
				<!-- Fixed-height slot so the layout doesn't jump when the retry appears. -->
				<div class="flex h-9 items-center">
					{#if status === 'slow'}
						<Button
							variant="outline"
							size="sm"
							onclick={signIn}
							disabled={retrying}
							aria-busy={retrying}
						>
							<RotateCcwIcon />{retrying ? 'Retrying…' : 'Taking a while? Try again'}
						</Button>
					{/if}
				</div>
			</div>
		{/if}

		<noscript>
			<p class="-mt-3 text-sm text-muted-foreground">JavaScript is required to sign in.</p>
		</noscript>
	</div>
</main>

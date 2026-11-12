<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import AppHeader from '$lib/components/app/AppHeader.svelte';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<div class="flex min-h-dvh flex-col">
	<AppHeader user={data.user} />
	<main
		class="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-8"
	>
		{@render children()}
	</main>
</div>

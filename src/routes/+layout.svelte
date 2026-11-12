<script lang="ts">
	import './layout.css';
	import type { Snippet } from 'svelte';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	let { children }: { children: Snippet } = $props();
</script>

<ModeWatcher disableHeadScriptInjection themeColors={{ light: '#f9f8f7', dark: '#0e0d0c' }} />
<Tooltip.Provider delayDuration={300}>
	{@render children()}
</Tooltip.Provider>
<Toaster position="bottom-center" />

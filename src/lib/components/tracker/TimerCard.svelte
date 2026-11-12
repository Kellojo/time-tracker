<script lang="ts">
	import PlayIcon from '@lucide/svelte/icons/play';
	import SquareIcon from '@lucide/svelte/icons/square';
	import LoaderIcon from '@lucide/svelte/icons/loader-2';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { formatClock } from '$lib/time';
	import { cn } from '$lib/utils.js';

	let {
		running,
		elapsedSeconds,
		bookingLabel,
		futureSelected,
		pending,
		ontoggle,
		onbooktoday
	}: {
		running: boolean;
		elapsedSeconds: number;
		/** The day a stop books onto, e.g. "today" or "Mon, 3 Nov". */
		bookingLabel: string;
		/** A future day is selected; live time still books on today. */
		futureSelected: boolean;
		pending: boolean;
		ontoggle: () => void;
		/** Re-targets the booking to today (selects today). */
		onbooktoday: () => void;
	} = $props();

	const offToday = $derived(bookingLabel !== 'today');
</script>

<Card.Root class={cn('relative', running && 'ring-success/40 dark:ring-success/40')}>
	<Card.Header>
		<Card.Title class="text-sm font-medium text-muted-foreground">Live timer</Card.Title>
		<Card.Action>
			<span
				class={cn(
					'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
					running ? 'bg-success/10 text-success-foreground' : 'bg-muted text-muted-foreground'
				)}
			>
				<span class="relative flex size-2">
					{#if running}
						<span
							class="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden"
						></span>
					{/if}
					<span
						class={cn(
							'relative inline-flex size-2 rounded-full',
							running ? 'bg-success' : 'bg-muted-foreground/50'
						)}
					></span>
				</span>
				{running ? 'Running' : 'Stopped'}
			</span>
		</Card.Action>
	</Card.Header>
	<Card.Content class="flex flex-col gap-5">
		<div>
			<p
				class={cn(
					'text-5xl font-semibold tracking-tight tabular transition-colors sm:text-6xl',
					!running && 'text-muted-foreground/70'
				)}
				aria-live="off"
			>
				{formatClock(elapsedSeconds)}
			</p>
			<!-- One line in every state, so the card keeps its height. -->
			<div class="mt-2 text-sm">
				{#if offToday}
					<!-- Time goes to a past day that was selected: make that hard to miss. -->
					<p class="text-warning-foreground">
						Books on <span class="font-medium">{bookingLabel}</span> ·
						<button
							type="button"
							class="font-medium text-foreground underline underline-offset-4 hover:decoration-foreground/60"
							onclick={onbooktoday}>Switch to today</button
						>
					</p>
				{:else if futureSelected}
					<p class="text-muted-foreground">Future days can’t take live time.</p>
				{:else}
					<p class="text-muted-foreground">
						{running ? 'Stop to book this time on today.' : 'Start the timer to track today.'}
					</p>
				{/if}
			</div>
		</div>
		<Button
			size="lg"
			variant={running ? 'destructive' : 'default'}
			class="h-11 w-full text-base"
			disabled={pending}
			onclick={ontoggle}
		>
			{#if pending}
				<LoaderIcon class="animate-spin" />
			{:else if running}
				<SquareIcon class="fill-current" />
			{:else}
				<PlayIcon class="fill-current" />
			{/if}
			{running ? (offToday ? `Stop & book on ${bookingLabel}` : 'Stop timer') : 'Start timer'}
		</Button>
	</Card.Content>
</Card.Root>

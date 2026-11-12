<script lang="ts">
	import BuildingIcon from '@lucide/svelte/icons/building';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { untrack } from 'svelte';
	import { DAILY_TARGET_MINUTES, formatMinutes, parseDuration } from '$lib/time';
	import { cn } from '$lib/utils.js';

	let {
		date,
		isToday,
		isFuture,
		minutes,
		storedMinutes,
		officeDay,
		saving,
		onsave,
		onofficechange
	}: {
		date: Date;
		isToday: boolean;
		isFuture: boolean;
		/** Tracked minutes including a running timer. */
		minutes: number;
		/** Booked minutes, what the editor changes. */
		storedMinutes: number;
		officeDay: boolean;
		saving: boolean;
		onsave: (minutes: number) => Promise<boolean>;
		onofficechange: (office: boolean) => void;
	} = $props();

	const label = $derived(
		date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
	);
	const isWeekend = $derived(date.getDay() === 0 || date.getDay() === 6);
	const overtime = $derived(Math.max(0, minutes - DAILY_TARGET_MINUTES));
	const running = $derived(Math.max(0, minutes - storedMinutes));
	// One track: it spans the target, or the whole day once past it (overtime fills the end).
	const scale = $derived(Math.max(minutes, DAILY_TARGET_MINUTES));
	const regularShare = $derived(Math.min(minutes, DAILY_TARGET_MINUTES) / scale);
	const overtimeShare = $derived(overtime / scale);
	const remaining = $derived(Math.max(0, DAILY_TARGET_MINUTES - minutes));

	const bookedText = (minutes: number) => (minutes > 0 ? formatMinutes(minutes) : '');
	let draft = $state(untrack(() => bookedText(storedMinutes)));
	let error = $state('');
	const inputId = $props.id();

	// Reset the editor whenever another day is selected or its booked total changes.
	$effect(() => {
		void date.getTime();
		draft = bookedText(storedMinutes);
		error = '';
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const parsed = draft.trim() === '' ? 0 : parseDuration(draft);
		if (parsed === null || parsed > 24 * 60) {
			error = `Couldn’t read “${draft.trim()}”. Try 7h 30m, 7:30, 7.5 or 45m.`;
			return;
		}
		error = '';
		await onsave(parsed);
	}

	const presets = [4 * 60, 6 * 60, 8 * 60];
</script>

<Card.Root>
	<Card.Header>
		<!-- Always two lines so the card doesn't jump; the page heading already shows today's date. -->
		<Card.Description>{isWeekend ? 'Weekend' : 'Selected day'}</Card.Description>
		<Card.Title class="text-base font-semibold">{isToday ? 'Today' : label}</Card.Title>
		{#if officeDay}
			<Card.Action>
				<span
					class="inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-xs font-medium text-info-foreground"
				>
					<BuildingIcon class="size-3" />Office
				</span>
			</Card.Action>
		{/if}
	</Card.Header>
	<Card.Content class="flex flex-col gap-5">
		<div class="flex flex-col gap-2.5">
			<div class="flex items-baseline justify-between gap-3">
				<div class="flex min-w-0 flex-col">
					<p class="text-3xl font-semibold tracking-tight tabular">{formatMinutes(minutes)}</p>
					{#if running > 0}
						<p class="mt-0.5 text-xs text-muted-foreground tabular">
							{formatMinutes(storedMinutes)} booked + {formatMinutes(running)} running
						</p>
					{/if}
				</div>
				<p class="text-sm text-muted-foreground tabular">
					{#if overtime > 0}
						<span class="font-medium text-warning-foreground"
							>+{formatMinutes(overtime)} overtime</span
						>
					{:else if minutes > 0 && !isWeekend}
						{formatMinutes(remaining)} to go
					{:else}
						of {formatMinutes(DAILY_TARGET_MINUTES)}
					{/if}
				</p>
			</div>
			<div
				class="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
				role="progressbar"
				aria-label="Progress towards the daily target"
				aria-valuemin={0}
				aria-valuemax={DAILY_TARGET_MINUTES}
				aria-valuenow={Math.min(minutes, DAILY_TARGET_MINUTES)}
				aria-valuetext={`${formatMinutes(minutes)} of ${formatMinutes(DAILY_TARGET_MINUTES)}${overtime > 0 ? `, ${formatMinutes(overtime)} overtime` : ''}`}
			>
				<div
					class="h-full rounded-full bg-heat transition-[width] duration-500 ease-out motion-reduce:transition-none"
					style:width={`${regularShare * 100}%`}
				></div>
				{#if overtime > 0}
					<div
						class="h-full flex-1 rounded-full bg-overtime"
						style:max-width={`${overtimeShare * 100}%`}
					></div>
				{/if}
			</div>
		</div>

		<form class="flex flex-col gap-2" onsubmit={submit} novalidate>
			<Label for={inputId}>Booked time</Label>
			<div class="flex gap-2">
				<Input
					id={inputId}
					bind:value={draft}
					placeholder="e.g. 7h 30m"
					autocomplete="off"
					inputmode="text"
					aria-invalid={error ? true : undefined}
					aria-describedby={`${inputId}-hint`}
					class="tabular"
				/>
				<Button type="submit" variant="secondary" disabled={saving}>Save</Button>
			</div>
			<div class="flex flex-wrap items-center gap-1.5">
				{#each presets as preset (preset)}
					<button
						type="button"
						class={cn(
							'h-7 rounded-full border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
							storedMinutes === preset && 'border-foreground/20 bg-muted text-foreground'
						)}
						disabled={saving}
						onclick={() => onsave(preset)}
					>
						{formatMinutes(preset)}
					</button>
				{/each}
				{#if storedMinutes > 0}
					<button
						type="button"
						class="h-7 rounded-full border border-dashed px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
						disabled={saving}
						onclick={() => onsave(0)}
					>
						Clear
					</button>
				{/if}
			</div>
			<p
				id={`${inputId}-hint`}
				class={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}
			>
				{error ||
					(isFuture
						? 'Replaces the booked total, e.g. for planned time off.'
						: 'Replaces the booked total. A running timer adds on top when stopped.')}
			</p>
		</form>

		<label
			class="flex items-center justify-between gap-4 rounded-2xl border bg-muted/30 px-3.5 py-3"
		>
			<span class="flex items-center gap-3">
				<span
					class="flex size-8 items-center justify-center rounded-lg bg-info/10 text-info-foreground"
				>
					<BuildingIcon class="size-4" />
				</span>
				<span class="flex flex-col">
					<span class="text-sm font-medium">Office day</span>
					<span class="text-xs text-muted-foreground">Worked on site</span>
				</span>
			</span>
			<Switch checked={officeDay} onCheckedChange={onofficechange} aria-label="Office day" />
		</label>
	</Card.Content>
</Card.Root>

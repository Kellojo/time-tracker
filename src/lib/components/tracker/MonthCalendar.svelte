<script lang="ts">
	import { tick } from 'svelte';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import BuildingIcon from '@lucide/svelte/icons/building';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		DAILY_TARGET_MINUTES,
		extraMinutesForDay,
		formatMinutes,
		formatSignedMinutes,
		parseIsoDate,
		toIsoDate
	} from '$lib/time';
	import { cn } from '$lib/utils.js';

	let {
		year,
		month,
		today,
		selected,
		minutesFor,
		isOffice,
		onselect,
		onmonthchange,
		class: className
	}: {
		year: number;
		/** 0-based month. */
		month: number;
		today: string;
		selected: string;
		minutesFor: (day: string) => number;
		isOffice: (day: string) => boolean;
		onselect: (day: string) => void;
		onmonthchange: (year: number, month: number) => void;
		class?: string;
	} = $props();

	const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	type Cell = { iso: string; date: Date; inMonth: boolean; minutes: number; office: boolean };

	const weeks = $derived.by(() => {
		// Whole Monday–Sunday weeks covering the month, spilling into its neighbours.
		const leading = (new Date(year, month, 1).getDay() + 6) % 7;
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const weekCount = Math.ceil((leading + daysInMonth) / 7);
		return Array.from({ length: weekCount }, (_, w) =>
			Array.from({ length: 7 }, (_, d): Cell => {
				const date = new Date(year, month, 1 - leading + w * 7 + d);
				const iso = toIsoDate(date);
				return {
					iso,
					date,
					inMonth: date.getMonth() === month,
					minutes: minutesFor(iso),
					office: isOffice(iso)
				};
			})
		);
	});

	const weekBalance = (week: Cell[]) =>
		week.reduce((sum, cell) => sum + extraMinutesForDay(cell.date, cell.minutes), 0);

	const monthCells = $derived(weeks.flat().filter((c) => c.inMonth));
	const monthTotal = $derived(monthCells.reduce((sum, c) => sum + c.minutes, 0));
	const monthBalance = $derived(
		monthCells.reduce((sum, c) => sum + extraMinutesForDay(c.date, c.minutes), 0)
	);
	const monthOffice = $derived(monthCells.filter((c) => c.office).length);
	const monthLabel = $derived(
		new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
	);
	const isCurrentMonth = $derived(
		today.startsWith(toIsoDate(new Date(year, month, 1)).slice(0, 7))
	);

	// Roving tabindex: one Tab stop for the whole grid, arrow keys move between days.
	const focusIso = $derived(
		weeks.flat().some((c) => c.iso === selected)
			? selected
			: (weeks.flat().find((c) => c.inMonth)?.iso ?? selected)
	);
	let gridEl: HTMLDivElement | undefined = $state();

	async function onGridKeydown(event: KeyboardEvent) {
		const from = parseIsoDate(focusIso);
		if (!from) return;
		// A local scratch value, not reactive state.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const next = new Date(from);
		const weekday = (from.getDay() + 6) % 7;
		switch (event.key) {
			case 'ArrowLeft':
				next.setDate(from.getDate() - 1);
				break;
			case 'ArrowRight':
				next.setDate(from.getDate() + 1);
				break;
			case 'ArrowUp':
				next.setDate(from.getDate() - 7);
				break;
			case 'ArrowDown':
				next.setDate(from.getDate() + 7);
				break;
			case 'Home':
				next.setDate(from.getDate() - weekday);
				break;
			case 'End':
				next.setDate(from.getDate() + 6 - weekday);
				break;
			case 'PageUp':
				next.setMonth(from.getMonth() - 1);
				break;
			case 'PageDown':
				next.setMonth(from.getMonth() + 1);
				break;
			default:
				return;
		}
		event.preventDefault();
		onselect(toIsoDate(next));
		await tick();
		gridEl?.querySelector<HTMLButtonElement>(`[data-iso="${toIsoDate(next)}"]`)?.focus();
	}

	function shift(delta: number) {
		const d = new Date(year, month + delta, 1);
		onmonthchange(d.getFullYear(), d.getMonth());
	}

	/** Tracked time tints the day; past the target the tint stays full. */
	function cellStyle(minutes: number, faded = false) {
		if (minutes <= 0) return undefined;
		// Days outside the month fade their fill only, so their text stays readable.
		const strength = (10 + Math.min(1, minutes / DAILY_TARGET_MINUTES) * 38) * (faded ? 0.45 : 1);
		return `background-color: color-mix(in oklch, var(--heat) ${strength.toFixed(1)}%, transparent)`;
	}

	/** Short duration for narrow cells: `8h`, `7h30`, `45m` (never a bare `00`). */
	function compact(minutes: number) {
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		if (h === 0) return `${m}m`;
		if (m === 0) return `${h}h`;
		return `${h}h${String(m).padStart(2, '0')}`;
	}

	function signedCompact(minutes: number) {
		const rounded = Math.round(minutes);
		if (rounded === 0) return '0m';
		return `${rounded < 0 ? '−' : '+'}${compact(Math.abs(rounded))}`;
	}

	function balanceClass(minutes: number) {
		if (Math.round(minutes) === 0) return 'text-muted-foreground';
		return minutes > 0 ? 'text-success-foreground' : 'text-destructive';
	}
</script>

<Card.Root class={className}>
	<Card.Header class="items-center">
		<Card.Title class="self-center text-lg">{monthLabel}</Card.Title>
		<Card.Action class="flex items-center gap-1 self-center">
			<Button variant="ghost" size="icon-sm" onclick={() => shift(-1)} aria-label="Previous month">
				<ChevronLeftIcon />
			</Button>
			<Button
				variant="outline"
				size="sm"
				disabled={isCurrentMonth && selected === today}
				onclick={() => {
					const now = new Date();
					onmonthchange(now.getFullYear(), now.getMonth());
					onselect(today);
				}}
			>
				Today
			</Button>
			<Button variant="ghost" size="icon-sm" onclick={() => shift(1)} aria-label="Next month">
				<ChevronRightIcon />
			</Button>
		</Card.Action>
	</Card.Header>
	<Card.Content class="max-sm:px-2">
		<p
			class="-mt-2 mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground tabular max-sm:px-2"
		>
			<span
				><span class="font-medium text-foreground">{formatMinutes(monthTotal)}</span> tracked</span
			>
			<span>
				<span class={cn('font-medium', balanceClass(monthBalance))}
					>{formatSignedMinutes(monthBalance)}</span
				> balance
			</span>
			<span
				><span class="font-medium text-foreground">{monthOffice}</span> office {monthOffice === 1
					? 'day'
					: 'days'}</span
			>
		</p>
		<div
			class="grid grid-cols-[repeat(7,minmax(0,1fr))_minmax(2.5rem,0.9fr)] gap-1 sm:gap-1.5"
			role="grid"
			aria-label={`${monthLabel}. Use the arrow keys to move between days.`}
			tabindex="-1"
			bind:this={gridEl}
			onkeydown={onGridKeydown}
		>
			<div class="contents" role="row">
				{#each WEEKDAYS as weekday (weekday)}
					<div
						role="columnheader"
						class="pb-1 text-center text-xs font-medium text-muted-foreground"
					>
						<span class="sm:hidden">{weekday.slice(0, 1)}</span><span class="max-sm:hidden"
							>{weekday}</span
						>
					</div>
				{/each}
				<div role="columnheader" class="pb-1 text-center text-xs font-medium text-muted-foreground">
					<span class="sm:hidden">Wk</span><span class="max-sm:hidden">Week</span>
				</div>
			</div>

			{#each weeks as week (week[0].iso)}
				{@const balance = weekBalance(week)}
				{@const future = week[0].iso > today}
				{@const empty = week.every((c) => c.minutes <= 0)}
				<div class="contents" role="row">
					{#each week as cell (cell.iso)}
						{@const isToday = cell.iso === today}
						{@const isSelected = cell.iso === selected}
						{@const weekend = cell.date.getDay() === 0 || cell.date.getDay() === 6}
						{@const over = cell.minutes > DAILY_TARGET_MINUTES}
						<button
							type="button"
							role="gridcell"
							data-iso={cell.iso}
							tabindex={cell.iso === focusIso ? 0 : -1}
							aria-selected={isSelected}
							aria-current={isToday ? 'date' : undefined}
							aria-label={`${cell.date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}: ${cell.minutes > 0 ? formatMinutes(cell.minutes) : 'nothing'} tracked${cell.office ? ', office day' : ''}`}
							onclick={() => onselect(cell.iso)}
							style={cellStyle(cell.minutes, !cell.inMonth)}
							class={cn(
								'group relative flex h-12 min-w-0 flex-col items-start justify-between overflow-hidden rounded-xl p-1.5 text-left transition-[box-shadow,background-color,opacity] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card sm:aspect-[1.1] sm:h-auto sm:p-2',
								cell.minutes <= 0 && 'bg-muted/40 hover:bg-muted',
								cell.minutes > 0 && 'hover:brightness-95 dark:hover:brightness-110',
								!cell.inMonth && 'text-muted-foreground',
								isSelected && 'ring-2 ring-foreground/80'
							)}
						>
							<span class="flex w-full items-center justify-between gap-1">
								<span
									class={cn(
										'flex size-5 items-center justify-center rounded-full text-xs font-medium tabular sm:size-6 sm:text-sm',
										weekend && !isToday && 'text-muted-foreground',
										isToday && 'bg-foreground text-background'
									)}
								>
									{cell.date.getDate()}
								</span>
								{#if cell.office}
									<BuildingIcon
										class="size-3.5 text-info-foreground max-sm:hidden"
										aria-hidden="true"
									/>
									<!-- Too narrow for the icon on phones: a dot in the corner instead. -->
									<span
										class="absolute top-1 right-1 size-1.5 rounded-full bg-info sm:hidden"
										aria-hidden="true"
									></span>
								{/if}
							</span>
							{#if cell.minutes > 0}
								<span
									class="text-[0.65rem] leading-none font-medium tracking-tight tabular sm:text-xs sm:tracking-normal"
								>
									<span class="sm:hidden">{compact(cell.minutes)}</span>
									<span class="max-sm:hidden">{formatMinutes(cell.minutes)}</span>
								</span>
							{/if}
							{#if over}
								<span
									class="absolute inset-x-1.5 bottom-0 h-0.75 rounded-t-full bg-overtime"
									aria-hidden="true"
								></span>
							{/if}
						</button>
					{/each}
					<div
						role="gridcell"
						class={cn(
							'flex items-center justify-center rounded-xl text-[0.65rem] font-medium tabular sm:text-xs',
							balanceClass(balance)
						)}
						aria-label={future || empty
							? undefined
							: `Week balance ${formatSignedMinutes(balance)}`}
					>
						{#if !future && !empty}
							<span class="sm:hidden">{signedCompact(balance)}</span>
							<span class="max-sm:hidden">{formatSignedMinutes(balance)}</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<div
			class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-muted-foreground"
		>
			<span class="flex items-center gap-1.5">
				<span class="flex gap-0.5" aria-hidden="true">
					{#each [0.25, 0.5, 0.75, 1] as level (level)}
						<span class="size-2.5 rounded-sm" style={cellStyle(level * DAILY_TARGET_MINUTES)}
						></span>
					{/each}
				</span>
				Towards {formatMinutes(DAILY_TARGET_MINUTES)}
			</span>
			<span class="flex items-center gap-1.5"
				><span class="h-0.75 w-3 rounded-full bg-overtime" aria-hidden="true"></span>Overtime</span
			>
			<span class="flex items-center gap-1.5"
				><BuildingIcon class="size-3 text-info-foreground max-sm:hidden" aria-hidden="true" /><span
					class="size-1.5 rounded-full bg-info sm:hidden"
					aria-hidden="true"
				></span>Office day</span
			>
		</div>
	</Card.Content>
</Card.Root>

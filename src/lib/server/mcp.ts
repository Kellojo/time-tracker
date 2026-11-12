/**
 * The MCP server exposing time tracking to AI clients. A fresh server is built per request
 * (stateless Streamable HTTP), bound to the authenticated principal; only the tools the
 * principal's scopes allow are listed.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { Principal } from '$lib/server/auth';
import {
	getTimerStatus,
	removeOfficeDay,
	setDayMinutes,
	setOfficeDay,
	startTimer,
	stopTimer
} from '$lib/server/db';
import {
	getDaySummary,
	getMonthSummary,
	getWeekSummary,
	getYearSummary
} from '$lib/server/tracker';
import type { Scope } from '$lib/scopes';
import {
	DAILY_TARGET_MINUTES,
	MONTH_RE,
	formatClock,
	formatMinutes,
	formatSignedMinutes,
	parseIsoDate,
	todayIso
} from '$lib/time';

const SERVER_INFO = { name: 'time-tracker', version: __VERSION__ || '0.0.0' };

const INSTRUCTIONS = `Time Tracker records how many minutes a person worked per calendar day, plus a live timer and office days.
Days are local dates in YYYY-MM-DD format; "today" is the server's local date (get_timer_status returns it).
The daily target is ${DAILY_TARGET_MINUTES / 60} hours on weekdays; balances show time worked beyond that target (weekend time counts fully).
Use set_day_hours to correct or backfill a day; it replaces that day's total rather than adding to it.`;

const dateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.refine((value) => parseIsoDate(value) !== null, 'Not a valid calendar date')
	.describe('A date in YYYY-MM-DD format.');

function result(text: string, structured: Record<string, unknown>): CallToolResult {
	return { content: [{ type: 'text', text }], structuredContent: structured };
}

function failure(text: string): CallToolResult {
	return { content: [{ type: 'text', text }], isError: true };
}

export function createMcpServer(principal: Principal) {
	const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });
	const { userId } = principal;
	const can = (scope: Scope) => principal.scopes.includes(scope);

	if (can('hours:read')) {
		server.registerTool(
			'get_timer_status',
			{
				title: 'Get timer status',
				description: "Whether the live timer is running, for how long, and today's tracked total.",
				annotations: { readOnlyHint: true }
			},
			async () => {
				const timer = getTimerStatus(userId);
				const today = getDaySummary(userId, todayIso());
				const text = timer.isRunning
					? `Timer running for ${formatClock(timer.elapsedSeconds)}. Today (${today.day}): ${formatMinutes(today.totalMinutesEffective)} tracked.`
					: `Timer stopped. Today (${today.day}): ${formatMinutes(today.totalMinutesEffective)} tracked.`;
				return result(text, { ...timer, today });
			}
		);

		server.registerTool(
			'get_day',
			{
				title: 'Get a day',
				description: 'Tracked time and office status for one day.',
				inputSchema: { date: dateSchema.optional().describe('Defaults to today.') },
				annotations: { readOnlyHint: true }
			},
			async ({ date }) => {
				const day = getDaySummary(userId, date ?? todayIso());
				const text = `${day.day}: ${formatMinutes(day.totalMinutesEffective)} tracked${day.officeDay ? ', office day' : ''}.`;
				return result(text, day);
			}
		);

		server.registerTool(
			'get_week',
			{
				title: 'Get a week',
				description:
					'Per-day tracked time for the Monday–Sunday week containing a date, with the week total and overtime balance.',
				inputSchema: {
					date: dateSchema.optional().describe('Any day in the week. Defaults to today.')
				},
				annotations: { readOnlyHint: true }
			},
			async ({ date }) => {
				const week = getWeekSummary(userId, date ? parseIsoDate(date)! : new Date());
				const lines = week.days.map(
					(d) =>
						`- ${d.day}: ${formatMinutes(d.totalMinutesEffective)}${week.officeDays.includes(d.day) ? ' (office)' : ''}`
				);
				const text = [
					`Week ${week.weekStart} to ${week.weekEnd}: ${formatMinutes(week.weekTotalMinutesEffective)} total, balance ${formatSignedMinutes(week.weekBalanceMinutes)}.`,
					...lines
				].join('\n');
				return result(text, week);
			}
		);

		server.registerTool(
			'get_month',
			{
				title: 'Get a month',
				description: 'Tracked days, office days, total and overtime balance for a calendar month.',
				inputSchema: {
					month: z
						.string()
						.regex(MONTH_RE)
						.optional()
						.describe('Month in YYYY-MM format. Defaults to the current month.')
				},
				annotations: { readOnlyHint: true }
			},
			async ({ month }) => {
				const [year, monthNumber] = (month ?? todayIso().slice(0, 7)).split('-').map(Number);
				const summary = getMonthSummary(userId, year, monthNumber - 1);
				const lines = summary.days.map(
					(d) =>
						`- ${d.day}: ${formatMinutes(d.totalMinutesEffective)}${summary.officeDays.includes(d.day) ? ' (office)' : ''}`
				);
				const text = [
					`${summary.month}: ${summary.totalHuman} over ${summary.days.length} tracked days, ${summary.officeDaysCount} office days, balance ${formatSignedMinutes(summary.balanceMinutes)}.`,
					...lines
				].join('\n');
				return result(text, summary);
			}
		);

		server.registerTool(
			'get_year',
			{
				title: 'Get a year',
				description: 'Total tracked time and office days for a calendar year.',
				inputSchema: {
					year: z.number().int().min(2000).max(2100).optional().describe('Defaults to this year.')
				},
				annotations: { readOnlyHint: true }
			},
			async ({ year }) => {
				const summary = getYearSummary(userId, year ?? new Date().getFullYear());
				const text = `${summary.year}: ${formatMinutes(summary.yearTotalMinutesEffective)} tracked, ${summary.officeDaysCount} office days.`;
				return result(text, summary);
			}
		);
	}

	if (can('timer:start')) {
		server.registerTool(
			'start_timer',
			{
				title: 'Start timer',
				description: 'Start the live timer. Its time is booked on the day it is stopped.',
				annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
			},
			async () => {
				const started = startTimer(userId);
				if (!started.started) return failure('The timer is already running.');
				return result('Timer started.', { started: true });
			}
		);
	}

	if (can('timer:stop')) {
		server.registerTool(
			'stop_timer',
			{
				title: 'Stop timer',
				description: "Stop the live timer and add the elapsed minutes to a day's total.",
				inputSchema: {
					date: dateSchema.optional().describe('Day to book the time on. Defaults to today.')
				},
				annotations: { readOnlyHint: false, destructiveHint: false }
			},
			async ({ date }) => {
				const stopped = stopTimer(userId, date ?? todayIso());
				if (!stopped.stopped) return failure('The timer is not running.');
				return result(
					`Timer stopped: added ${formatMinutes(stopped.addedMinutes)}, day total is now ${formatMinutes(stopped.totalMinutes)}.`,
					stopped
				);
			}
		);
	}

	if (can('hours:write')) {
		server.registerTool(
			'set_day_hours',
			{
				title: 'Set hours for a day',
				description:
					"Replace a day's tracked total. Use 0 to clear a day. Does not affect a running timer.",
				inputSchema: {
					date: dateSchema,
					minutes: z
						.number()
						.int()
						.min(0)
						.max(24 * 60)
						.describe('Total minutes worked that day.')
				},
				annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true }
			},
			async ({ date, minutes }) => {
				const totalMinutes = setDayMinutes(userId, date, minutes);
				return result(`${date} set to ${formatMinutes(totalMinutes)}.`, {
					day: date,
					totalMinutes
				});
			}
		);
	}

	if (can('office:write')) {
		server.registerTool(
			'set_office_day',
			{
				title: 'Set office day',
				description: 'Mark a day as worked from the office, or unmark it.',
				inputSchema: {
					date: dateSchema.optional().describe('Defaults to today.'),
					office: z.boolean().default(true).describe('true to mark, false to unmark.')
				},
				annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
			},
			async ({ date, office }) => {
				const day = date ?? todayIso();
				if (office) setOfficeDay(userId, day);
				else removeOfficeDay(userId, day);
				return result(`${day} ${office ? 'marked' : 'unmarked'} as office day.`, {
					day,
					officeDay: office
				});
			}
		);
	}

	return server;
}

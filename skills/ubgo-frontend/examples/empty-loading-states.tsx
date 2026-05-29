// Empty + Loading + Error states — Polaris-dense reference primitives.
//
// Drop into: src/components/ui/states.tsx
//
// One-line states for inside table/list containers. NOT a full-page splash — those go in
// AdminShell-level error boundaries.
//
// Rules:
// - Loading is a thin muted strip, NOT a spinner. Spinners stress users; muted strip whispers.
// - Empty state ALWAYS names the primary action. "No items yet" without naming the next step
//   is dead-end UX.
// - Error state offers Retry. Always.

import * as React from "react"
import { cn } from "@/lib/utils"

export function LoadingState({
	className,
	children = "Loading…",
}: {
	className?: string
	children?: React.ReactNode
}) {
	return (
		<div
			className={cn(
				"rounded-md border border-border bg-background px-3 py-2 text-[11px] text-muted-foreground",
				className,
			)}
		>
			{children}
		</div>
	)
}

export interface EmptyStateProps {
	/** Body text. Should mention the primary CTA by name. */
	children: React.ReactNode
	/** Optional icon — lucide, rendered at size-5 muted. */
	icon?: React.ReactNode
	/** Optional inline CTA button. */
	action?: React.ReactNode
	className?: string
}

export function EmptyState({ icon, children, action, className }: EmptyStateProps) {
	return (
		<div
			className={cn(
				"rounded-md border border-dashed border-border bg-background py-8 px-4 flex flex-col items-center gap-2 text-center",
				className,
			)}
		>
			{icon ? (
				<span className="text-muted-foreground [&_svg]:size-5">{icon}</span>
			) : null}
			<div className="text-[12px] text-muted-foreground">{children}</div>
			{action}
		</div>
	)
}

export interface ErrorStateProps {
	children: React.ReactNode
	onRetry?: () => void
	className?: string
}

export function ErrorState({ children, onRetry, className }: ErrorStateProps) {
	return (
		<div
			className={cn(
				"rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5 flex items-center justify-between gap-3 text-[12px]",
				className,
			)}
		>
			<div className="text-destructive">{children}</div>
			{onRetry ? (
				<button
					type="button"
					onClick={onRetry}
					className="cursor-pointer rounded px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10"
				>
					Retry
				</button>
			) : null}
		</div>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// Usage:
//
//   {loading ? (
//     <LoadingState />
//   ) : error ? (
//     <ErrorState onRetry={reload}>Could not load API keys.</ErrorState>
//   ) : rows.length === 0 ? (
//     <EmptyState
//       icon={<KeyRound />}
//       action={<Button onClick={() => setCreateOpen(true)}>New key</Button>}
//     >
//       No API keys yet. Click <span className="font-medium text-foreground">New key</span> to mint one.
//     </EmptyState>
//   ) : (
//     <DataTable rows={rows} columns={columns} getRowKey={(r) => r.id} rowActions={...} />
//   )}

// Skeleton — Polaris-dense reference primitive.
//
// Drop into: src/components/ui/skeleton.tsx
//
// Subtle shimmering bar that mimics the eventual content's shape. Use during initial loads
// where the layout would otherwise jump when data arrives. For tables, render 3–5 skeleton
// rows matching the column widths.
//
// IMPORTANT: gate every Skeleton behind a useDelayedFlag(loading, 200ms) hook so it doesn't
// flash on fast nav. The brief flash reads as a bug; the delayed render reads as smooth.

import * as React from "react"
import { cn } from "@/lib/utils"

export function Skeleton({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"animate-pulse rounded-md bg-muted/70",
				className,
			)}
			{...props}
		/>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// useDelayedFlag — flips to true after `delay`ms, immediately to false.
// Use to suppress brief loading flashes that are visually distracting.
// ─────────────────────────────────────────────────────────────────────────────

export function useDelayedFlag(value: boolean, delay = 200): boolean {
	const [flag, setFlag] = React.useState(false)
	React.useEffect(() => {
		if (!value) {
			setFlag(false)
			return
		}
		const id = setTimeout(() => setFlag(true), delay)
		return () => clearTimeout(id)
	}, [value, delay])
	return flag
}

// ─────────────────────────────────────────────────────────────────────────────
// SkeletonRow — pre-shaped row for inside a DataTable.
// ─────────────────────────────────────────────────────────────────────────────

export function SkeletonRow({ columns = 5 }: { columns?: number }) {
	return (
		<tr className="border-b border-border">
			{Array.from({ length: columns }).map((_, i) => (
				<td key={i} className="px-3 py-2">
					<Skeleton className="h-3.5 w-full max-w-[180px]" />
				</td>
			))}
		</tr>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// Usage in a list page:
//
//   const showSkeleton = useDelayedFlag(loading, 200)
//
//   {showSkeleton ? (
//     <DataTable rows={Array(5).fill({}).map((_, i) => ({ id: String(i) }))} ... />
//     // OR a bare <table> with <SkeletonRow /> × 5
//   ) : loading ? null : rows.length === 0 ? <EmptyState>…</EmptyState> : <DataTable rows={rows} ... />}
// ─────────────────────────────────────────────────────────────────────────────

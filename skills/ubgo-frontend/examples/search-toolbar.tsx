// SearchInput + Toolbar — Polaris-dense reference primitives.
//
// Drop into: src/components/ui/search-input.tsx and src/components/ui/toolbar.tsx
//
// Toolbar = the row of controls between PageHeader and the table (search + filter chips +
// view switcher + result counter). Sub-section of every list page.

import * as React from "react"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// SearchInput — h-7 with leading search icon + clearable
// ─────────────────────────────────────────────────────────────────────────────

export interface SearchInputProps
	extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
	value: string
	onChange: (value: string) => void
	onClear?: () => void
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
	({ className, value, onChange, onClear, placeholder = "Search…", ...props }, ref) => {
		return (
			<div className={cn("relative w-full max-w-[280px]", className)}>
				<Search
					aria-hidden
					className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground"
				/>
				<input
					ref={ref}
					type="search"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={placeholder}
					className={cn(
						"border-input bg-background h-7 w-full rounded-md border pl-7 pr-7 text-[12px] outline-none transition-colors",
						"placeholder:text-muted-foreground",
						"focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring",
					)}
					{...props}
				/>
				{value && onClear ? (
					<button
						type="button"
						onClick={onClear}
						aria-label="Clear search"
						className="absolute right-1 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
					>
						<X className="size-3" />
					</button>
				) : null}
			</div>
		)
	},
)
SearchInput.displayName = "SearchInput"

// ─────────────────────────────────────────────────────────────────────────────
// Toolbar — flex row with left (search + filters) and right (counter + view) slots
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolbarProps {
	left?: React.ReactNode // search input + filter chips
	right?: React.ReactNode // result counter + view-switcher
	className?: string
}

export function Toolbar({ left, right, className }: ToolbarProps) {
	return (
		<div
			className={cn(
				"flex items-center justify-between gap-2 mb-2",
				className,
			)}
		>
			<div className="flex items-center gap-2 min-w-0 flex-1">{left}</div>
			{right ? (
				<div className="flex items-center gap-2 shrink-0">{right}</div>
			) : null}
		</div>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// FilterChip — small toggleable filter for the toolbar
// ─────────────────────────────────────────────────────────────────────────────

export interface FilterChipProps {
	active?: boolean
	onClick?: () => void
	children: React.ReactNode
	count?: number
}

export function FilterChip({ active, onClick, children, count }: FilterChipProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"inline-flex items-center gap-1 h-7 px-2 rounded-md text-[12px] cursor-pointer transition-colors",
				active
					? "bg-primary/10 text-primary"
					: "text-foreground/80 hover:bg-muted",
			)}
		>
			{children}
			{typeof count === "number" ? (
				<span className="tabular-nums text-foreground/60">{count}</span>
			) : null}
		</button>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// ResultCounter — right-aligned tabular-nums counter
// ─────────────────────────────────────────────────────────────────────────────

export function ResultCounter({
	loading,
	count,
	noun,
}: {
	loading?: boolean
	count: number
	noun: string // "keys", "members", "products"
}) {
	return (
		<span className="text-[11px] text-muted-foreground tabular-nums">
			{loading ? "…" : `${count} ${noun}`}
		</span>
	)
}

// NativeSelect — verbatim reference primitive.
//
// Copy to: src/components/ui/native-select.tsx
//
// Why this exists:
// Raw HTML <select> ships with an OS-level chevron + extra padding that breaks h-7/h-8 row
// alignment. On macOS some browsers render a faint second chevron-like artifact at the
// bottom border of an outlined select. Both fixed by appearance-none + an absolute lucide
// chevron overlay.
//
// Use this everywhere a native <select> is the right control (simple enum picker, no
// search, no async). For typeahead / multi-select / async options, reach for Base UI
// Select or Combobox instead.

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface NativeSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
	className?: string
}

export const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
	({ className, children, ...props }, ref) => {
		return (
			<div className="relative inline-block w-full">
				<select
					ref={ref}
					className={cn(
						"appearance-none border-input bg-background flex h-7 w-full min-w-0 rounded-md border px-2.5 pr-7 text-[12px] outline-none cursor-pointer transition-colors",
						"focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring",
						"aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/30",
						"disabled:cursor-not-allowed disabled:opacity-50",
						className,
					)}
					{...props}
				>
					{children}
				</select>
				<ChevronDown
					aria-hidden
					className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground"
				/>
			</div>
		)
	},
)
NativeSelect.displayName = "NativeSelect"

// Polaris-dense Input — verbatim reference primitive.
//
// Copy to: src/components/ui/input.tsx
//
// Why this shape:
// - h-7 px-2.5 text-[12px] rounded-md matches the Button at the same size — chrome lines up.
// - Flat 1px border-input. No shadow-sm. No border-t darker trick.
//   The "inset-shadow" / "two-tone-border" patterns read as box-shadow artifacts at small
//   sizes and users routinely flag them.
// - Clean focus: focus-visible:border-ring + ring-1 ring-ring. No 3px diffuse ring.
// - aria-invalid lights up destructive border + ring.

import * as React from "react"
import { cn } from "@/lib/utils"

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
	({ className, type, ...props }, ref) => {
		return (
			<input
				ref={ref}
				type={type}
				className={cn(
					"file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground",
					"border-input dark:bg-input/30 flex h-7 w-full min-w-0 rounded-md border bg-background px-2.5 py-0.5 text-[12px] transition-colors outline-none",
					"file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-[12px] file:font-medium",
					"focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring",
					"aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/30",
					"disabled:cursor-not-allowed disabled:opacity-50",
					className,
				)}
				{...props}
			/>
		)
	},
)
Input.displayName = "Input"

// Tooltip + Popover — Polaris-dense reference primitives.
//
// Drop into: src/components/ui/tooltip.tsx and src/components/ui/popover.tsx
//
// Tooltip = small hover-only hint, ~120ms delay open. Popover = click-to-open rich content
// (filter picker, color swatch, metadata panel).
//
// Rules:
// - Tooltip: bg-foreground text-background text-[11px] px-2 py-1 rounded
//   ~6px from anchor, max-w-[240px] for long hints
// - Popover: bg-popover border border-border rounded-md shadow-md p-2 min-w-[180px]
//   ~6px from anchor
// - Use Tooltip for terse hints (button labels for icon-only buttons, truncated text).
// - Use Popover for interactive content (multi-step picker, info card with links).
// - NEVER nest a Tooltip inside a clickable element — confuses screen readers; the button
//   should aria-label itself.

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip
// ─────────────────────────────────────────────────────────────────────────────

export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export const TooltipContent = React.forwardRef<
	React.ElementRef<typeof TooltipPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
	<TooltipPrimitive.Content
		ref={ref}
		sideOffset={sideOffset}
		className={cn(
			"z-50 max-w-[240px] rounded bg-foreground text-background text-[11px] px-2 py-1",
			"data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95",
			"data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
			className,
		)}
		{...props}
	/>
))
TooltipContent.displayName = "TooltipContent"

// Convenience wrapper — common case.
export function Tip({
	label,
	children,
	side = "top",
}: {
	label: React.ReactNode
	children: React.ReactNode
	side?: "top" | "right" | "bottom" | "left"
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent side={side}>{label}</TooltipContent>
		</Tooltip>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// Popover
// ─────────────────────────────────────────────────────────────────────────────

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverAnchor = PopoverPrimitive.Anchor

export const PopoverContent = React.forwardRef<
	React.ElementRef<typeof PopoverPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, sideOffset = 6, align = "center", ...props }, ref) => (
	<PopoverPrimitive.Portal>
		<PopoverPrimitive.Content
			ref={ref}
			sideOffset={sideOffset}
			align={align}
			className={cn(
				"z-50 min-w-[180px] rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md outline-none",
				"data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
				"data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
				className,
			)}
			{...props}
		/>
	</PopoverPrimitive.Portal>
))
PopoverContent.displayName = "PopoverContent"

// ─────────────────────────────────────────────────────────────────────────────
// Usage:
//
//   <TooltipProvider delayDuration={120}>
//     <Tip label="Revoke key">
//       <Button variant="ghost" size="icon"><Trash2 /></Button>
//     </Tip>
//   </TooltipProvider>
//
//   <Popover>
//     <PopoverTrigger asChild><Button variant="outline">Filter</Button></PopoverTrigger>
//     <PopoverContent align="start">
//       <div className="space-y-1.5">...filter form...</div>
//     </PopoverContent>
//   </Popover>
// ─────────────────────────────────────────────────────────────────────────────

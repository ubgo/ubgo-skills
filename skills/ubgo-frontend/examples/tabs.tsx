// Tabs — Polaris-dense reference primitive.
//
// Drop into: src/components/ui/tabs.tsx
//
// Polaris tabs are an h-9 row of trigger labels with a 2px underline indicator on the
// active tab. NOT pills, NOT background-colored, NOT shadow-elevated. The underline IS
// the affordance — clean and unmistakable.
//
// Rules:
// - TabsList: flex border-b border-border, no bg
// - TabsTrigger: px-3 py-2 text-[13px] font-medium text-foreground/70
//   active: text-foreground + border-b-2 border-primary (negative -mb-px to overlap the list's border-b)
// - cursor-pointer on every trigger
// - hover: text-foreground (no bg-muted — keeps the line clean)
//
// Built on Radix Tabs.

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

export const Tabs = TabsPrimitive.Root

export const TabsList = React.forwardRef<
	React.ElementRef<typeof TabsPrimitive.List>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.List
		ref={ref}
		className={cn(
			"inline-flex h-9 items-center border-b border-border w-full justify-start gap-0",
			className,
		)}
		{...props}
	/>
))
TabsList.displayName = "TabsList"

export const TabsTrigger = React.forwardRef<
	React.ElementRef<typeof TabsPrimitive.Trigger>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.Trigger
		ref={ref}
		className={cn(
			"inline-flex items-center justify-center cursor-pointer transition-colors",
			"px-3 py-2 text-[13px] font-medium -mb-px",
			"text-foreground/70 hover:text-foreground border-b-2 border-transparent",
			"data-[state=active]:text-foreground data-[state=active]:border-primary",
			"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1",
			"disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
			className,
		)}
		{...props}
	/>
))
TabsTrigger.displayName = "TabsTrigger"

export const TabsContent = React.forwardRef<
	React.ElementRef<typeof TabsPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.Content
		ref={ref}
		className={cn("mt-3 focus-visible:outline-none", className)}
		{...props}
	/>
))
TabsContent.displayName = "TabsContent"

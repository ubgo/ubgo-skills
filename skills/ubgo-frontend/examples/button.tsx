// Polaris-dense Button — verbatim reference primitive.
//
// Copy to: src/components/ui/button.tsx
//
// Why this shape:
// - h-7 default with text-[12px] font-medium is the Polaris / Linear / Vercel target.
// - cursor-pointer baked at base — every variant shows hand cursor without per-call-site work.
// - No shadow on any variant; the only press feedback is active:translate-y-px.
// - disabled:cursor-not-allowed paired with disabled:opacity-50 disabled:pointer-events-none.
// - Adjacent SVG defaults to size-3.5 (matches the text size).

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
	[
		"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium",
		"transition-all outline-none shrink-0",
		"cursor-pointer",
		"disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
		"[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
		"focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1",
	].join(" "),
	{
		variants: {
			variant: {
				default:
					"bg-primary text-primary-foreground hover:bg-primary/90 active:translate-y-px",
				outline:
					"border border-input bg-background text-foreground hover:bg-muted hover:text-foreground active:translate-y-px",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-secondary/80 active:translate-y-px",
				ghost:
					"text-foreground/80 hover:bg-muted hover:text-foreground active:translate-y-px",
				soft: "bg-primary/10 text-primary hover:bg-primary/15 active:translate-y-px",
				destructive:
					"bg-destructive text-destructive-foreground hover:bg-destructive/90 active:translate-y-px",
				link: "text-primary underline-offset-4 hover:underline px-0 h-auto",
			},
			size: {
				// Polaris-dense default — text-[12px], h-7. Use everywhere chrome.
				default:
					"h-7 rounded-lg gap-1.5 px-3 text-[12px] font-medium has-[>svg]:px-2.5 [&_svg]:size-3.5",
				xs: "h-6 rounded-md gap-1 px-2 text-[11px] font-medium has-[>svg]:px-1.5 [&_svg]:size-3",
				sm: "h-7 rounded-lg gap-1.5 px-3 text-[12px] font-medium has-[>svg]:px-2.5 [&_svg]:size-3.5",
				// For full-width form submits in narrow centred cards (login etc).
				md: "h-8 rounded-lg gap-1.5 px-3.5 text-[13px] font-medium has-[>svg]:px-3 [&_svg]:size-4",
				// Marketing / hero only.
				lg: "h-9 rounded-lg px-4 text-[13px] font-medium has-[>svg]:px-3.5",
				icon: "size-7 [&_svg]:size-3.5",
				"icon-sm": "size-6 [&_svg]:size-3",
				"icon-lg": "size-8 [&_svg]:size-4",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
)

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button"
		return (
			<Comp
				ref={ref}
				className={cn(buttonVariants({ variant, size, className }))}
				{...props}
			/>
		)
	},
)
Button.displayName = "Button"

export { buttonVariants }

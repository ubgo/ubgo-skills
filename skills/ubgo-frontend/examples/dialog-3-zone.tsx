// 3-zone Dialog primitive — verbatim reference.
//
// Copy to: src/components/ui/dialog.tsx
//
// Why this shape (Polaris-grade):
// - Header / Body / Footer with explicit separator lines. Body scrolls; header + footer stay
//   pinned. Avoids the "buttons drift up" failure mode when content is short.
// - Close X has cursor-pointer baked in.
// - Title at text-[15px] font-semibold — denser than shadcn default.
// - Footer has bg-muted/40 + border-t for a soft toolbar feel (matches Polaris modals).
// - DialogBody is a NEW exported zone — without it, callers rebuild the same padded-overflow
//   div on every dialog.
//
// Built on Base UI / Radix Dialog (swap import per project).

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogPortal = DialogPrimitive.Portal
export const DialogClose = DialogPrimitive.Close

export const DialogOverlay = React.forwardRef<
	React.ElementRef<typeof DialogPrimitive.Overlay>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Overlay
		ref={ref}
		className={cn(
			"fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]",
			"data-[state=open]:animate-in data-[state=open]:fade-in-0",
			"data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
			className,
		)}
		{...props}
	/>
))
DialogOverlay.displayName = "DialogOverlay"

export interface DialogContentProps
	extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
	showCloseButton?: boolean
}

export const DialogContent = React.forwardRef<
	React.ElementRef<typeof DialogPrimitive.Content>,
	DialogContentProps
>(({ className, children, showCloseButton = true, ...props }, ref) => (
	<DialogPortal>
		<DialogOverlay />
		<DialogPrimitive.Content
			ref={ref}
			className={cn(
				"fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
				"w-[calc(100%-2rem)] max-w-[400px] max-h-[calc(100dvh-2rem)]",
				"flex flex-col overflow-hidden",
				"rounded-xl border border-border bg-background shadow-lg",
				"data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
				"data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
				className,
			)}
			{...props}
		>
			{children}
			{showCloseButton && (
				<DialogPrimitive.Close
					data-slot="dialog-close"
					className={cn(
						"absolute top-2.5 right-2.5 cursor-pointer rounded p-1",
						"text-muted-foreground opacity-80 hover:bg-muted/60 hover:opacity-100",
						"focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
						"disabled:pointer-events-none disabled:cursor-not-allowed",
						"[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
					)}
				>
					<XIcon />
					<span className="sr-only">Close</span>
				</DialogPrimitive.Close>
			)}
		</DialogPrimitive.Content>
	</DialogPortal>
))
DialogContent.displayName = "DialogContent"

// Zone 1 — Header. Title + optional description. border-b separator.
export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"flex flex-col gap-1 px-4 py-3 border-b border-border",
				// space at the right for the absolute X close (pr-8).
				"pr-8",
				className,
			)}
			{...props}
		/>
	)
}

// Zone 2 — Body. Scrolls. Own padding.
export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("px-4 py-3 overflow-y-auto", className)} {...props} />
}

// Zone 3 — Footer. Right-aligned actions. Soft muted bg + border-t.
export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
				"px-4 py-2.5 border-t border-border bg-muted/40",
				className,
			)}
			{...props}
		/>
	)
}

export const DialogTitle = React.forwardRef<
	React.ElementRef<typeof DialogPrimitive.Title>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Title
		ref={ref}
		className={cn("text-[15px] font-semibold leading-tight tracking-tight", className)}
		{...props}
	/>
))
DialogTitle.displayName = "DialogTitle"

export const DialogDescription = React.forwardRef<
	React.ElementRef<typeof DialogPrimitive.Description>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Description
		ref={ref}
		className={cn("text-[12px] text-muted-foreground", className)}
		{...props}
	/>
))
DialogDescription.displayName = "DialogDescription"

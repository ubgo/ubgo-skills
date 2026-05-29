// Form Label + FieldError + helpers — Polaris-dense reference primitives.
//
// Drop into: src/components/ui/label.tsx, src/components/ui/field.tsx
//
// Rules:
// - Field spacing inside a form: space-y-3 (dense). NOT space-y-4.
// - Label: text-[12px] font-medium text-foreground. NO uppercase mono tracker — that flavor is
//   editorial; use the legibility flavor on form chrome (consistent with §29.7 table headers).
// - Help text: text-[11px] text-muted-foreground mt-1.
// - Error text: text-[11px] text-destructive mt-1.
// - No asterisk for required — disable submit until valid instead.

import * as React from "react"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// Label
// ─────────────────────────────────────────────────────────────────────────────

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
	/** Render an editorial-style uppercase mono tracker (rare; reserve for tasteful side panels). */
	editorial?: boolean
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
	({ className, editorial, ...props }, ref) => (
		<label
			ref={ref}
			className={cn(
				editorial
					? "text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-mono mb-1 block"
					: "text-[12px] font-medium text-foreground mb-1 block",
				className,
			)}
			{...props}
		/>
	),
)
Label.displayName = "Label"

// ─────────────────────────────────────────────────────────────────────────────
// Field — wraps label + control + help/error text in a single block.
// ─────────────────────────────────────────────────────────────────────────────

export interface FieldProps {
	label?: React.ReactNode
	htmlFor?: string
	help?: React.ReactNode
	error?: React.ReactNode
	children: React.ReactNode
	className?: string
}

export function Field({ label, htmlFor, help, error, children, className }: FieldProps) {
	return (
		<div className={cn("space-y-1.5", className)}>
			{label ? <Label htmlFor={htmlFor}>{label}</Label> : null}
			{children}
			{error ? (
				<p className="text-[11px] text-destructive mt-1">{error}</p>
			) : help ? (
				<p className="text-[11px] text-muted-foreground mt-1">{help}</p>
			) : null}
		</div>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// FormRow — two-column label-on-left layout (use only when labels are short + glanceable).
// ─────────────────────────────────────────────────────────────────────────────

export function FormRow({
	label,
	htmlFor,
	help,
	error,
	children,
	className,
}: FieldProps) {
	return (
		<div
			className={cn(
				"grid grid-cols-[140px_minmax(0,1fr)] gap-2 items-start",
				className,
			)}
		>
			<Label htmlFor={htmlFor} className="pt-1.5 mb-0">
				{label}
			</Label>
			<div className="space-y-1">
				{children}
				{error ? (
					<p className="text-[11px] text-destructive">{error}</p>
				) : help ? (
					<p className="text-[11px] text-muted-foreground">{help}</p>
				) : null}
			</div>
		</div>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// Form — wraps fields in a vertical stack at dense spacing.
// ─────────────────────────────────────────────────────────────────────────────

export function Form({
	className,
	...props
}: React.FormHTMLAttributes<HTMLFormElement>) {
	return <form className={cn("space-y-3", className)} {...props} />
}

// ConfirmDialog — Polaris-grade reusable confirmation primitive.
//
// Drop into: src/components/ui/confirm-dialog.tsx
//
// Replaces window.confirm() (which has terrible UX) with a real 3-zone Dialog.
//
// Usage patterns:
// - Destructive (delete, revoke, archive) — variant="destructive"
// - Cautious (publish, send, finalize) — variant="default"
//
// Headline pattern: "Verb the noun?" — "Revoke this API key?", "Delete 3 products?",
// "Sign out everywhere?". Description states the irreversibility / scope.

import * as React from "react"
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export interface ConfirmDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description?: React.ReactNode
	confirmLabel?: string
	cancelLabel?: string
	variant?: "default" | "destructive"
	onConfirm: () => void | Promise<void>
	/** When true, shows "…ing" label + disables buttons. */
	busy?: boolean
	/** When true, requires typing the entity name to enable confirm. */
	requireText?: string
}

export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel = "Confirm",
	cancelLabel = "Cancel",
	variant = "default",
	onConfirm,
	busy,
	requireText,
}: ConfirmDialogProps) {
	const [typed, setTyped] = React.useState("")
	React.useEffect(() => {
		if (!open) setTyped("")
	}, [open])

	const canConfirm = !busy && (!requireText || typed === requireText)

	async function handle(e: React.FormEvent) {
		e.preventDefault()
		if (!canConfirm) return
		await onConfirm()
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<form onSubmit={handle} className="contents">
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
					</DialogHeader>
					<DialogBody>
						{description ? (
							<div className="text-[12px] text-muted-foreground">
								{description}
							</div>
						) : null}
						{requireText ? (
							<div className="mt-3 space-y-1.5">
								<label className="text-[12px] font-medium text-foreground block">
									Type <span className="font-mono text-foreground">{requireText}</span> to confirm
								</label>
								<input
									autoFocus
									value={typed}
									onChange={(e) => setTyped(e.target.value)}
									className="border-input bg-background h-7 w-full rounded-md border px-2.5 text-[12px] font-mono outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
									autoComplete="off"
									spellCheck={false}
								/>
							</div>
						) : null}
					</DialogBody>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={busy}
						>
							{cancelLabel}
						</Button>
						<Button
							type="submit"
							variant={variant === "destructive" ? "destructive" : "default"}
							disabled={!canConfirm}
						>
							{busy ? `${confirmLabel.replace(/e?$/, "ing")}…` : confirmLabel}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook flavor — useConfirm() returns a function that opens the dialog and resolves
// the user's answer. Cleaner at call sites that don't want to manage open state.
// ─────────────────────────────────────────────────────────────────────────────

interface ConfirmRequest extends Omit<ConfirmDialogProps, "open" | "onOpenChange" | "onConfirm" | "busy"> {}

interface ConfirmContextValue {
	confirm: (req: ConfirmRequest) => Promise<boolean>
}

const ConfirmContext = React.createContext<ConfirmContextValue | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
	const [state, setState] = React.useState<
		(ConfirmRequest & { resolve: (v: boolean) => void }) | null
	>(null)
	const [busy, setBusy] = React.useState(false)

	const confirm = React.useCallback(
		(req: ConfirmRequest) =>
			new Promise<boolean>((resolve) => {
				setState({ ...req, resolve })
			}),
		[],
	)

	return (
		<ConfirmContext.Provider value={{ confirm }}>
			{children}
			{state ? (
				<ConfirmDialog
					open
					onOpenChange={(o) => {
						if (!o) {
							state.resolve(false)
							setState(null)
							setBusy(false)
						}
					}}
					busy={busy}
					{...state}
					onConfirm={async () => {
						setBusy(true)
						try {
							state.resolve(true)
						} finally {
							setBusy(false)
							setState(null)
						}
					}}
				/>
			) : null}
		</ConfirmContext.Provider>
	)
}

export function useConfirm() {
	const ctx = React.useContext(ConfirmContext)
	if (!ctx) throw new Error("useConfirm must be used inside ConfirmProvider")
	return ctx.confirm
}

// ─────────────────────────────────────────────────────────────────────────────
// Usage:
//
//   const confirm = useConfirm()
//
//   async function onRevoke(id: string) {
//     const ok = await confirm({
//       title: "Revoke this API key?",
//       description: "Existing callers will start receiving 401 immediately.",
//       confirmLabel: "Revoke key",
//       variant: "destructive",
//     })
//     if (!ok) return
//     await revokeApiKey(id)
//     toast.success("Key revoked")
//     await reload()
//   }
// ─────────────────────────────────────────────────────────────────────────────

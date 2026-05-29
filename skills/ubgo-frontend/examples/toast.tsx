// Toast (sonner) — Polaris-dense reference setup.
//
// Drop into: src/components/ui/toast.tsx + mount <Toaster /> once in the root layout.
//
// Sonner is the canonical toast library (lightweight, accessible, queues correctly). Polaris-
// dense theming: rounded-md, border-border, bg-popover, text-[12px], no shadow-heavy elevation.
//
// Use cases:
// - Mutation succeeded (auto-dismiss 3s)
// - Mutation failed (with Retry action, longer duration)
// - Background event surfaced (e.g. "Invite accepted by Grace") — info-tone
//
// NEVER use a toast for:
// - Validation errors INSIDE a form — use inline field errors
// - Destructive confirmation — use ConfirmDialog
// - First-time tutorials — use Callout / inline UI

import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner"

// ─────────────────────────────────────────────────────────────────────────────
// Mount once. Put in src/routes/__root.tsx or wherever the app shell renders.
// ─────────────────────────────────────────────────────────────────────────────

export function Toaster() {
	return (
		<SonnerToaster
			position="bottom-right"
			closeButton
			toastOptions={{
				classNames: {
					toast:
						"!rounded-md !border !border-border !bg-popover !text-popover-foreground !text-[12px] !shadow-md",
					title: "!text-[12px] !font-medium",
					description: "!text-[11px] !text-muted-foreground",
					actionButton:
						"!bg-primary !text-primary-foreground !rounded !px-2 !py-0.5 !text-[11px] !cursor-pointer hover:!bg-primary/90",
					cancelButton:
						"!bg-transparent !text-muted-foreground !text-[11px] !cursor-pointer hover:!text-foreground",
					closeButton:
						"!border-border !bg-popover !text-muted-foreground hover:!text-foreground !cursor-pointer",
					success: "!text-emerald-700 dark:!text-emerald-400",
					error: "!text-destructive",
					warning: "!text-amber-700 dark:!text-amber-400",
					info: "!text-foreground",
				},
				duration: 3000,
			}}
		/>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// Thin wrapper so call sites import from one place (easier to swap libs later).
// ─────────────────────────────────────────────────────────────────────────────

export const toast = {
	success: (msg: string, opts?: { description?: string; duration?: number }) =>
		sonnerToast.success(msg, opts),
	error: (
		msg: string,
		opts?: { description?: string; onRetry?: () => void; duration?: number },
	) =>
		sonnerToast.error(msg, {
			...opts,
			duration: opts?.duration ?? 6000,
			action: opts?.onRetry
				? { label: "Retry", onClick: opts.onRetry }
				: undefined,
		}),
	info: (msg: string, opts?: { description?: string; duration?: number }) =>
		sonnerToast(msg, opts),
	warning: (msg: string, opts?: { description?: string; duration?: number }) =>
		sonnerToast.warning(msg, opts),
	loading: (msg: string) => sonnerToast.loading(msg),
	dismiss: (id?: string | number) => sonnerToast.dismiss(id),
}

// ─────────────────────────────────────────────────────────────────────────────
// Usage:
//
//   import { toast } from "@/components/ui/toast"
//
//   try {
//     await deleteKey(id)
//     toast.success("Key revoked")
//   } catch (e) {
//     toast.error("Could not revoke key", { onRetry: () => deleteKey(id) })
//   }
// ─────────────────────────────────────────────────────────────────────────────

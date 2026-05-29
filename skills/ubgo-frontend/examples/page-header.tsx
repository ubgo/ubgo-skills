// PageHeader — verbatim reference primitive (Shopify-admin / Polaris shape).
//
// Copy to: src/components/admin-shell.tsx (export `PageHeader`).
//
// Five slots, one separator line, owned BY THE LEAF PAGE (never auto-injected by a layout
// that switches on route — that's brittle and blocks per-page CTAs).
//
// Used like:
//
//   <PageHeader
//     icon={<KeyRound />}
//     title="API keys"
//     subtitle="Machine credentials for plugins, scripts, and webhooks"
//     primaryAction={
//       <Button onClick={() => setCreateOpen(true)} className="gap-1">
//         <Plus className="size-3" />
//         New key
//       </Button>
//     }
//     secondaryActions={<Button variant="outline">Import</Button>}
//   />

import * as React from "react"

export interface PageHeaderProps {
	icon?: React.ReactNode
	title: string
	subtitle?: string
	primaryAction?: React.ReactNode
	secondaryActions?: React.ReactNode
	/** Right-most slot (e.g. a count chip or status pill). Renders after primaryAction. */
	right?: React.ReactNode
}

export function PageHeader({
	icon,
	title,
	subtitle,
	primaryAction,
	secondaryActions,
	right,
}: PageHeaderProps) {
	const hasActions = Boolean(primaryAction || secondaryActions || right)
	return (
		<div className="flex items-center justify-between gap-4 border-b border-border pb-3 mb-4">
			<div className="flex items-center gap-2 min-w-0">
				{icon ? (
					<span className="text-foreground/80 [&_svg]:size-[18px]">{icon}</span>
				) : null}
				<div className="min-w-0">
					<h1 className="text-[18px] font-semibold tracking-tight leading-tight truncate">
						{title}
					</h1>
					{subtitle ? (
						<p className="text-[12px] text-muted-foreground mt-0.5">{subtitle}</p>
					) : null}
				</div>
			</div>
			{hasActions ? (
				<div className="flex items-center gap-2 shrink-0">
					{secondaryActions}
					{primaryAction}
					{right}
				</div>
			) : null}
		</div>
	)
}

// DataTable — Polaris-grade list table primitive.
//
// Drop into: src/components/ui/data-table.tsx
//
// Generic + typed. Define columns once; rows + per-row action menu render verbatim.
// Used by every list page. For server-paginated / sort-by-column / filter-by-facet tables,
// reach for the project's ServerDataTable instead — this is the lighter primitive.
//
// Density rules baked in (frontend.md §29.7 legibility flavor):
// - thead: bg-muted/50 text-[12px] text-foreground (NOT uppercase tiny gray)
//   <th>: font-semibold text-foreground (NOT muted-foreground)
// - tbody: divide-y divide-border
// - row hover: hover:bg-muted/60
// - body cell primary: font-medium text-foreground; secondary: text-foreground/70
// - numeric: tabular-nums
// - row-action ellipsis column: w-[40px] px-1 py-1 last
// - cursor-pointer on the ellipsis button

import * as React from "react"
import { MoreHorizontal } from "lucide-react"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export interface ColumnDef<TRow> {
	key: string
	header: React.ReactNode
	width?: string // tailwind class (e.g. "w-[160px]")
	className?: string // class merged onto every <td> in this column
	render: (row: TRow) => React.ReactNode
}

export interface RowAction<TRow> {
	label: string
	onClick: (row: TRow) => void
	variant?: "default" | "destructive"
	disabled?: (row: TRow) => boolean
}

export interface DataTableProps<TRow> {
	rows: TRow[]
	columns: ColumnDef<TRow>[]
	getRowKey: (row: TRow) => string
	rowActions?: RowAction<TRow>[] | ((row: TRow) => RowAction<TRow>[])
	onRowClick?: (row: TRow) => void
	className?: string
}

export function DataTable<TRow>({
	rows,
	columns,
	getRowKey,
	rowActions,
	onRowClick,
	className,
}: DataTableProps<TRow>) {
	const hasActions = Boolean(rowActions)
	return (
		<div
			className={cn(
				"rounded-md border border-border bg-background overflow-hidden",
				className,
			)}
		>
			<table className="w-full text-[13px]">
				<thead className="bg-muted/50 text-[12px] text-foreground">
					<tr className="border-b border-border">
						{columns.map((col) => (
							<th
								key={col.key}
								className={cn(
									"text-left font-semibold px-3 py-2",
									col.width,
									col.className,
								)}
							>
								{col.header}
							</th>
						))}
						{hasActions ? <th className="px-3 py-2 w-[40px]" /> : null}
					</tr>
				</thead>
				<tbody className="divide-y divide-border">
					{rows.map((row) => {
						const actions =
							typeof rowActions === "function"
								? rowActions(row)
								: rowActions
						return (
							<tr
								key={getRowKey(row)}
								className={cn(
									"hover:bg-muted/60 transition-colors",
									onRowClick && "cursor-pointer",
								)}
								onClick={onRowClick ? () => onRowClick(row) : undefined}
							>
								{columns.map((col) => (
									<td
										key={col.key}
										className={cn("px-3 py-2", col.className)}
									>
										{col.render(row)}
									</td>
								))}
								{hasActions && actions && actions.length > 0 ? (
									<td
										className="px-1 py-1"
										onClick={(e) => e.stopPropagation()}
									>
										<DropdownMenu>
											<DropdownMenuTrigger className="cursor-pointer rounded p-1 hover:bg-muted text-foreground/70 hover:text-foreground">
												<MoreHorizontal className="size-3.5" />
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												{actions.map((a, i) => (
													<DropdownMenuItem
														key={i}
														variant={a.variant}
														disabled={a.disabled?.(row)}
														onClick={() => a.onClick(row)}
													>
														{a.label}
													</DropdownMenuItem>
												))}
											</DropdownMenuContent>
										</DropdownMenu>
									</td>
								) : hasActions ? (
									<td className="px-1 py-1" />
								) : null}
							</tr>
						)
					})}
				</tbody>
			</table>
		</div>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// Usage:
//
// const columns: ColumnDef<Row>[] = [
//   { key: "name", header: "Name", render: (r) => <span className="font-medium text-foreground truncate max-w-[260px]">{r.name}</span> },
//   { key: "prefix", header: "Prefix", width: "w-[160px]", render: (r) => <span className="font-mono text-[12px] text-foreground/70">ak_{r.prefix}_…</span> },
//   { key: "lastUsed", header: "Last used", width: "w-[130px]", className: "text-foreground/70 tabular-nums", render: (r) => r.lastUsedAt ? new Date(r.lastUsedAt).toLocaleDateString() : "—" },
// ]
//
// <DataTable
//   rows={keys}
//   columns={columns}
//   getRowKey={(r) => r.id}
//   rowActions={(row) => [
//     { label: "Revoke key", variant: "destructive", onClick: () => onRevoke(row.id), disabled: () => !!row.revokedAt },
//   ]}
// />

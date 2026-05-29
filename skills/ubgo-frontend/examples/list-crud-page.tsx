// Full reference list/CRUD page — verbatim, Polaris-grade.
//
// Demonstrates every pattern at once:
// - PageHeader with icon + primary CTA
// - Sub-toolbar counter
// - Three-branch render (loading / empty / data table)
// - Legibility-flavor table headers
// - Row hover, per-row ellipsis menu
// - 3-zone create dialog
// - Reveal dialog after create
//
// Adapted from sync_go's API keys page; rename + retype to fit any list resource.

import { useEffect, useState } from "react"
import { Plus, Copy, MoreHorizontal, Check, KeyRound } from "lucide-react"
import { PageHeader } from "@/components/admin-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Replace with your project's API. Shape:
interface Row {
	id: string
	name: string
	prefix: string
	scope: "ACCOUNT" | "WORKSPACE"
	lastUsedAt: string | null
	revokedAt: string | null
}

declare const listMyApiKeys: () => Promise<Row[]>
declare const createApiKey: (name: string) => Promise<{ raw: string }>
declare const revokeApiKey: (id: string) => Promise<void>

export function ApiKeysPage() {
	const [rows, setRows] = useState<Row[]>([])
	const [loading, setLoading] = useState(true)
	const [createOpen, setCreateOpen] = useState(false)
	const [revealOpen, setRevealOpen] = useState(false)
	const [revealedSecret, setRevealedSecret] = useState("")
	const [newName, setNewName] = useState("")
	const [busy, setBusy] = useState(false)
	const [copied, setCopied] = useState(false)

	async function reload() {
		setLoading(true)
		try {
			setRows(await listMyApiKeys())
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		void reload()
	}, [])

	async function onCreate(e: React.FormEvent) {
		e.preventDefault()
		setBusy(true)
		try {
			const { raw } = await createApiKey(newName.trim() || "Untitled key")
			setRevealedSecret(raw)
			setNewName("")
			setCreateOpen(false)
			setRevealOpen(true)
			setCopied(false)
			await reload()
		} finally {
			setBusy(false)
		}
	}

	async function onRevoke(id: string) {
		if (!confirm("Revoke this API key? Existing callers will start receiving 401.")) return
		await revokeApiKey(id)
		await reload()
	}

	async function copySecret() {
		await navigator.clipboard.writeText(revealedSecret)
		setCopied(true)
		setTimeout(() => setCopied(false), 1500)
	}

	return (
		<div>
			<PageHeader
				icon={<KeyRound />}
				title="API keys"
				subtitle="Machine credentials for plugins, scripts, and webhooks"
				primaryAction={
					<Button onClick={() => setCreateOpen(true)} className="gap-1">
						<Plus className="size-3" />
						New key
					</Button>
				}
			/>

			{/* Sub-toolbar — counter only. */}
			<div className="mb-2 text-[11px] text-muted-foreground tabular-nums">
				{loading ? "…" : `${rows.length} keys`}
			</div>

			{/* Three branches. */}
			{loading ? (
				<div className="rounded-md border border-border bg-background px-3 py-2 text-[11px] text-muted-foreground">
					Loading…
				</div>
			) : rows.length === 0 ? (
				<div className="rounded-md border border-dashed border-border bg-background py-8 text-[12px] text-muted-foreground text-center">
					No API keys yet. Click{" "}
					<span className="font-medium text-foreground">New key</span> to mint one.
				</div>
			) : (
				<div className="rounded-md border border-border bg-background overflow-hidden">
					<table className="w-full text-[13px]">
						<thead className="bg-muted/50 text-[12px] text-foreground">
							<tr className="border-b border-border">
								<th className="text-left font-semibold px-3 py-2">Name</th>
								<th className="text-left font-semibold px-3 py-2 w-[160px]">Prefix</th>
								<th className="text-left font-semibold px-3 py-2 w-[100px]">Scope</th>
								<th className="text-left font-semibold px-3 py-2 w-[130px]">Last used</th>
								<th className="text-left font-semibold px-3 py-2 w-[90px]">Status</th>
								<th className="px-3 py-2 w-[40px]" />
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{rows.map((r) => (
								<tr key={r.id} className="hover:bg-muted/60">
									<td className="px-3 py-2 font-medium text-foreground truncate max-w-[260px]">
										{r.name}
									</td>
									<td className="px-3 py-2 font-mono text-[12px] text-foreground/70">
										ak_{r.prefix}_…
									</td>
									<td className="px-3 py-2 text-foreground/70">
										{r.scope.toLowerCase()}
									</td>
									<td className="px-3 py-2 text-foreground/70 tabular-nums">
										{r.lastUsedAt
											? new Date(r.lastUsedAt).toLocaleDateString()
											: "—"}
									</td>
									<td className="px-3 py-2">
										{r.revokedAt ? (
											<span className="inline-flex items-center gap-1.5 text-[12px] text-destructive">
												<span className="size-1.5 rounded-full bg-destructive" />
												Revoked
											</span>
										) : (
											<span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-700 dark:text-emerald-400">
												<span className="size-1.5 rounded-full bg-emerald-500" />
												Active
											</span>
										)}
									</td>
									<td className="px-1 py-1">
										{!r.revokedAt && (
											<DropdownMenu>
												<DropdownMenuTrigger className="cursor-pointer rounded p-1 hover:bg-muted text-foreground/70 hover:text-foreground">
													<MoreHorizontal className="size-3.5" />
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														variant="destructive"
														onClick={() => onRevoke(r.id)}
													>
														Revoke key
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{/* Create dialog — 3-zone. */}
			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent>
					<form onSubmit={onCreate} className="contents">
						<DialogHeader>
							<DialogTitle>Create API key</DialogTitle>
						</DialogHeader>
						<DialogBody>
							<div className="space-y-1.5">
								<Label htmlFor="name">Label</Label>
								<Input
									id="name"
									value={newName}
									onChange={(e) => setNewName(e.target.value)}
									placeholder="e.g. Feed export script"
									autoFocus
									autoComplete="off"
									spellCheck={false}
								/>
							</div>
						</DialogBody>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setCreateOpen(false)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={busy}>
								{busy ? "Creating…" : "Create key"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Reveal dialog — show-once secret. */}
			<Dialog open={revealOpen} onOpenChange={setRevealOpen}>
				<DialogContent className="sm:max-w-[440px]">
					<DialogHeader>
						<DialogTitle>Your new API key</DialogTitle>
					</DialogHeader>
					<DialogBody>
						<div className="space-y-2">
							<p className="text-[12px] text-muted-foreground">
								Copy this now — it will not be shown again.
							</p>
							<div className="relative">
								<pre className="rounded-md border border-border bg-muted/40 p-2.5 pr-10 text-[12px] font-mono break-all whitespace-pre-wrap">
									{revealedSecret}
								</pre>
								<button
									type="button"
									onClick={copySecret}
									className="absolute top-1.5 right-1.5 cursor-pointer rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
									aria-label="Copy"
								>
									{copied ? (
										<Check className="size-3.5 text-emerald-500" />
									) : (
										<Copy className="size-3.5" />
									)}
								</button>
							</div>
						</div>
					</DialogBody>
					<DialogFooter>
						<Button onClick={() => setRevealOpen(false)}>I saved it</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}

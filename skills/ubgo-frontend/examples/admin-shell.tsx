// AdminShell + Sidebar + PageHeader + StatusBadge — verbatim Polaris-dense reference.
//
// Drop into: src/components/admin-shell.tsx
//
// Layout: fixed-width sidebar on the left, scrolling content on the right. Sidebar shows
// brand → sections (mixed-case labels, NOT uppercase tracking-wider) → nav items (px-2 py-1.5,
// icons size-[16px]) → user menu pinned to the bottom.
//
// Density rules baked in (see frontend.md §29.1.5):
// - nav p-2, items px-2 py-1.5 rounded-md text-[13px]
// - inactive: text-foreground/80 (NEVER text-muted-foreground — too washy)
// - active: bg-primary/10 text-primary (NO shadow)
// - section labels: text-[11px] font-semibold text-foreground/80 mixed-case
// - icons: size-[16px] (chrome size; not size-4 / not size-5)
// - solid border-border on every divider (no /40, /60, /80)

import * as React from "react"
import { Link, useLocation } from "@tanstack/react-router"
import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// PageHeader — leaf-owned, 5 slots. See examples/page-header.tsx.
// ─────────────────────────────────────────────────────────────────────────────

export interface PageHeaderProps {
	icon?: React.ReactNode
	title: string
	subtitle?: string
	primaryAction?: React.ReactNode
	secondaryActions?: React.ReactNode
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

// ─────────────────────────────────────────────────────────────────────────────
// AdminShell — the page chrome wrapper. Sidebar + content.
// ─────────────────────────────────────────────────────────────────────────────

export interface NavItem {
	to: string
	label: string
	icon: LucideIcon
	exact?: boolean // exact-match active state; default uses startsWith
}

export interface NavSection {
	label?: string // optional — top section can be label-less
	items: NavItem[]
}

export interface AdminShellProps {
	brand: { label: string; icon?: React.ReactNode; to: string }
	sections: NavSection[]
	footer?: React.ReactNode // user menu / org switcher
	children: React.ReactNode
}

export function AdminShell({ brand, sections, footer, children }: AdminShellProps) {
	const { pathname } = useLocation()
	return (
		<div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
			<Sidebar>
				{/* Brand */}
				<Link
					to={brand.to}
					className="flex items-center gap-2 px-3 h-11 border-b border-border shrink-0 hover:bg-muted/40 transition-colors"
				>
					{brand.icon ? (
						<span className="grid place-items-center size-6 rounded-md bg-primary text-primary-foreground [&_svg]:size-3.5">
							{brand.icon}
						</span>
					) : null}
					<span className="text-[13px] font-semibold tracking-tight truncate">
						{brand.label}
					</span>
				</Link>

				{/* Nav */}
				<nav className="flex-1 overflow-y-auto p-2 space-y-3">
					{sections.map((section, i) => (
						<div key={i} className="space-y-0.5">
							{section.label ? (
								<div className="px-2 pt-1 pb-1 text-[11px] font-semibold text-foreground/80">
									{section.label}
								</div>
							) : null}
							{section.items.map((item) => (
								<NavLink key={item.to} item={item} pathname={pathname} />
							))}
						</div>
					))}
				</nav>

				{/* Footer (user menu) */}
				{footer ? (
					<div className="border-t border-border p-2 shrink-0">{footer}</div>
				) : null}
			</Sidebar>

			<main className="flex-1 overflow-y-auto">{children}</main>
		</div>
	)
}

function Sidebar({ children }: { children: React.ReactNode }) {
	return (
		<aside className="flex flex-col w-[220px] shrink-0 border-r border-border bg-sidebar">
			{children}
		</aside>
	)
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
	const isActive = item.exact ? pathname === item.to : pathname.startsWith(item.to)
	const Icon = item.icon
	return (
		<Link
			to={item.to}
			className={cn(
				"flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors",
				"[&_svg]:size-[16px] [&_svg]:shrink-0",
				isActive
					? "bg-primary/10 text-primary font-medium"
					: "text-foreground/80 hover:bg-muted hover:text-foreground",
			)}
		>
			<Icon />
			<span className="truncate">{item.label}</span>
		</Link>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// StatusBadge — inline status pill (dot + label). Polaris-style.
// ─────────────────────────────────────────────────────────────────────────────

export interface StatusBadgeProps {
	tone: "active" | "draft" | "archived" | "error" | "warn" | "info"
	children: React.ReactNode
}

const TONE_CLASS: Record<StatusBadgeProps["tone"], string> = {
	active:
		"text-emerald-700 dark:text-emerald-400 [&>span:first-child]:bg-emerald-500",
	draft: "text-foreground/70 [&>span:first-child]:bg-foreground/40",
	archived: "text-muted-foreground [&>span:first-child]:bg-muted-foreground/60",
	error: "text-destructive [&>span:first-child]:bg-destructive",
	warn: "text-amber-700 dark:text-amber-400 [&>span:first-child]:bg-amber-500",
	info: "text-blue-700 dark:text-blue-400 [&>span:first-child]:bg-blue-500",
}

export function StatusBadge({ tone, children }: StatusBadgeProps) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 text-[12px]",
				TONE_CLASS[tone],
			)}
		>
			<span className="size-1.5 rounded-full" />
			{children}
		</span>
	)
}

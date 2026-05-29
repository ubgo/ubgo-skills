// SettingsShell — sub-shell for nested /settings/* routes.
//
// Drop into: src/components/settings-shell.tsx
//
// Reuses AdminShell but with a tighter second-level sidebar (Account / API keys / Tenants /
// Members / General). The outer AdminShell wraps it from a higher-up layout — this shell only
// adds the per-section nav.
//
// Density matches AdminShell exactly so visual transitions between top-level and second-level
// nav are seamless.

import * as React from "react"
import { Link, useLocation } from "@tanstack/react-router"
import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SettingsNavItem {
	to: string
	label: string
	icon: LucideIcon
}

export interface SettingsShellProps {
	heading?: string // optional small heading above the nav (e.g. "Personal" or tenant name)
	items: SettingsNavItem[]
	children: React.ReactNode
}

export function SettingsShell({ heading, items, children }: SettingsShellProps) {
	const { pathname } = useLocation()
	return (
		<div className="flex h-full w-full overflow-hidden">
			<aside className="flex flex-col w-[200px] shrink-0 border-r border-border bg-background">
				{heading ? (
					<div className="px-3 h-11 flex items-center border-b border-border">
						<span className="text-[13px] font-semibold tracking-tight truncate text-foreground/90">
							{heading}
						</span>
					</div>
				) : null}
				<nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
					{items.map((item) => {
						const isActive = pathname === item.to || pathname.startsWith(item.to + "/")
						const Icon = item.icon
						return (
							<Link
								key={item.to}
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
					})}
				</nav>
			</aside>
			<main className="flex-1 overflow-y-auto">{children}</main>
		</div>
	)
}

// Avatar + UserMenu — Polaris-dense sidebar footer.
//
// Drop into: src/components/ui/avatar.tsx + src/components/user-menu.tsx
//
// UserMenu is the row at the bottom of the sidebar: avatar (initials in primary-tinted
// square) + name + email + chevron. Clicking opens a dropdown with switch-org / settings /
// sign-out actions.

import * as React from "react"
import { ChevronsUpDown, LogOut, Settings, User } from "lucide-react"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// Avatar — initials in a primary-tinted square. NOT a circle (Polaris uses squares with
// soft radius). Falls back to initials when no image.
// ─────────────────────────────────────────────────────────────────────────────

export interface AvatarProps {
	name: string
	email?: string
	src?: string | null
	size?: "sm" | "md" | "lg"
	className?: string
}

const SIZE_CLASS: Record<NonNullable<AvatarProps["size"]>, string> = {
	sm: "size-5 text-[9px]",
	md: "size-7 text-[11px]",
	lg: "size-9 text-[13px]",
}

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
	const initials = name
		.split(/\s+/)
		.slice(0, 2)
		.map((w) => w[0]?.toUpperCase() ?? "")
		.join("")

	if (src) {
		return (
			<img
				src={src}
				alt={name}
				className={cn(
					"rounded-md object-cover shrink-0",
					SIZE_CLASS[size],
					className,
				)}
			/>
		)
	}

	return (
		<span
			aria-label={name}
			className={cn(
				"inline-flex items-center justify-center rounded-md bg-primary/10 text-primary font-semibold shrink-0",
				SIZE_CLASS[size],
				className,
			)}
		>
			{initials || "?"}
		</span>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// UserMenu — the sidebar footer row + dropdown.
// ─────────────────────────────────────────────────────────────────────────────

export interface UserMenuProps {
	name: string
	email: string
	avatarSrc?: string | null
	onProfile: () => void
	onSettings: () => void
	onSignOut: () => void
}

export function UserMenu({
	name,
	email,
	avatarSrc,
	onProfile,
	onSettings,
	onSignOut,
}: UserMenuProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				className={cn(
					"w-full cursor-pointer rounded-md px-2 py-1.5 transition-colors",
					"flex items-center gap-2 text-left",
					"hover:bg-muted",
				)}
			>
				<Avatar name={name} src={avatarSrc} size="md" />
				<div className="flex-1 min-w-0">
					<div className="text-[12px] font-medium text-foreground truncate">
						{name}
					</div>
					<div className="text-[11px] text-muted-foreground truncate">
						{email}
					</div>
				</div>
				<ChevronsUpDown
					aria-hidden
					className="size-3 text-muted-foreground shrink-0"
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" side="top" className="min-w-[200px]">
				<DropdownMenuLabel>{email}</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={onProfile}>
					<User /> Profile
				</DropdownMenuItem>
				<DropdownMenuItem onClick={onSettings}>
					<Settings /> Settings
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="destructive" onClick={onSignOut}>
					<LogOut /> Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

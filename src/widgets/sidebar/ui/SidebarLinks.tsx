import type { MouseEvent, ReactNode } from "react";

import { lang } from "../../../shared/lib/index.js";
import { Icon, Tooltip, type IconName } from "../../../shared/ui/index.js";
import { SIDEBAR_SHORTCUT_LABELS } from "../model/sidebar.ts";

function SidebarLink({
	icon,
	label,
	onClick,
	shortcut,
	active = false,
	href = "#",
}: {
	icon: IconName;
	label: ReactNode;
	onClick: () => void;
	shortcut?: string;
	active?: boolean;
	href?: string;
}) {
	const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
		if (href !== "#" && (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0)) return;
		event.preventDefault();
		onClick();
	};

	return (
		<Tooltip delay={1200} content={shortcut} disabled={!shortcut}>
			<a href={href} className={`Sidebar__link${active ? " Sidebar__link__active" : ""}`} aria-current={active ? "page" : undefined} onClick={handleClick}>
				<Icon name={icon} />
				<span>{label}</span>
			</a>
		</Tooltip>
	);
}

interface SidebarLinksProps {
	onOpenGallery: () => void;
	isGalleryActive: boolean;
	onOpenBestiary: () => void;
	onOpenSpells: () => void;
	onOpenRulesReference: () => void;
}

export default function SidebarLinks({
	onOpenGallery,
	isGalleryActive,
	onOpenBestiary,
	onOpenSpells,
	onOpenRulesReference,
}: SidebarLinksProps) {
	return (
		<div className="Sidebar__links">
			<h2 className="Sidebar__sectionTitle">
				<span>{lang.t("Library")}</span>
			</h2>
			<SidebarLink
				icon="skull"
				label={lang.t("Bestiary")}
				shortcut={SIDEBAR_SHORTCUT_LABELS.bestiary}
				onClick={onOpenBestiary}
			/>
			<SidebarLink
				icon="magic"
				label={lang.t("Spells")}
				shortcut={SIDEBAR_SHORTCUT_LABELS.spells}
				onClick={onOpenSpells}
			/>
			<SidebarLink
				icon="list"
				label={lang.t("Rules Reference")}
				shortcut={SIDEBAR_SHORTCUT_LABELS.rulesReference}
				onClick={onOpenRulesReference}
			/>
			<SidebarLink
				icon="image"
				label={lang.t("Gallery")}
				shortcut={SIDEBAR_SHORTCUT_LABELS.gallery}
				active={isGalleryActive}
				onClick={onOpenGallery}
			/>
		</div>
	);
}

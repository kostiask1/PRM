import type { MouseEvent, ReactNode } from "react";

import { lang } from "../../../shared/lib/index.js";
import { Icon, type IconName } from "../../../shared/ui/index.js";

function SidebarLink({
	icon,
	label,
	onClick,
	active = false,
	href = "#",
}: {
	icon: IconName;
	label: ReactNode;
	onClick: () => void;
	active?: boolean;
	href?: string;
}) {
	const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
		if (href !== "#" && (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0)) return;
		event.preventDefault();
		onClick();
	};

	return (
		<a href={href} className={`Sidebar__link${active ? " Sidebar__link__active" : ""}`} aria-current={active ? "page" : undefined} onClick={handleClick}>
			<Icon name={icon} />
			<span>{label}</span>
		</a>
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
			<h2 className="Sidebar__sectionTitle">{lang.t("Library")}</h2>
			<SidebarLink
				icon="skull"
				label={lang.t("Bestiary")}
				onClick={onOpenBestiary}
			/>
			<SidebarLink
				icon="magic"
				label={lang.t("Spells")}
				onClick={onOpenSpells}
			/>
			<SidebarLink
				icon="list"
				label={lang.t("Rules Reference")}
				onClick={onOpenRulesReference}
			/>
			<SidebarLink
				icon="image"
				label={lang.t("Gallery")}
				active={isGalleryActive}
				onClick={onOpenGallery}
			/>
		</div>
	);
}

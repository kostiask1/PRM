import type { MouseEvent, ReactNode } from "react";

import { lang } from "../../../shared/lib/index.js";
import { Icon, type IconName } from "../../../shared/ui/index.js";

function SidebarLink({
	icon,
	label,
	onClick,
}: {
	icon: IconName;
	label: ReactNode;
	onClick: () => void;
}) {
	const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
		event.preventDefault();
		onClick();
	};

	return (
		<a href="#" className="Sidebar__link" onClick={handleClick}>
			<Icon name={icon} />
			<span>{label}</span>
		</a>
	);
}

interface SidebarLinksProps {
	onOpenGallery: () => void;
	onOpenBestiary: () => void;
	onOpenSpells: () => void;
	onOpenRulesReference: () => void;
}

export default function SidebarLinks({
	onOpenGallery,
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
				onClick={onOpenGallery}
			/>
		</div>
	);
}

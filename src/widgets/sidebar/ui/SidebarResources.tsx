import type { MouseEvent } from "react";

import { lang } from "../../../shared/lib/index.js";
import { Icon, type IconName } from "../../../shared/ui/index.js";

const EXTERNAL_RESOURCES: Array<{
	href: string;
	icon: IconName;
	label: string;
}> = [
	{
		href: "https://homebrewery.naturalcrit.com/",
		icon: "book",
		label: "Homebrewery",
	},
	{
		href: "https://crowsnest.me/tokenizer/",
		icon: "user",
		label: "Tokenizer",
	},
	{
		href: "https://forgottenadventures.piwigo.com",
		icon: "layers",
		label: "Assets",
	},
	{
		href: "https://www.owlbear.rodeo/",
		icon: "monitor",
		label: "Owlbear Rodeo",
	},
	{
		href: "https://kemono.cr/patreon/user/16010661",
		icon: "map",
		label: "Szepeku maps",
	},
	{
		href: "https://chatgpt.com/g/g-69c24d157a348191b640bf111b486080-ttrpg-map-architect",
		icon: "wand",
		label: "Map Architect (AI)",
	},
];

export default function SidebarResources({
	onOpenPlayerQuestions,
}: {
	onOpenPlayerQuestions: () => void;
}) {
	const handlePlayerQuestions = (event: MouseEvent<HTMLAnchorElement>) => {
		event.preventDefault();
		onOpenPlayerQuestions();
	};

	return (
		<div className="Sidebar__section Sidebar__section__resources">
			<div className="Sidebar__resource_list">
				{EXTERNAL_RESOURCES.map((resource) => (
					<a
						key={resource.href}
						href={resource.href}
						target="_blank"
						rel="noopener noreferrer"
						className="Sidebar__resource_item"
					>
						<Icon name={resource.icon} size={16} />
						<span>
							{resource.label === "Szepeku maps"
								? lang.t(resource.label)
								: resource.label}
						</span>
					</a>
				))}
				<a
					href="#"
					className="Sidebar__resource_item"
					onClick={handlePlayerQuestions}
				>
					<Icon name="help" size={16} />
					<span>{lang.t("Player questions")}</span>
				</a>
			</div>
		</div>
	);
}

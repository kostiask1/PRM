import { lang } from "../../../shared/lib/index.js";
import { Icon, Tooltip, type IconName } from "../../../shared/ui/index.js";
import { SIDEBAR_SHORTCUT_LABELS } from "../model/sidebar.ts";

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
		href: "https://chatgpt.com/plugins/plugin_4771db7bd38c819198b3a5f0bc06ff63",
		icon: "wand",
		label: "Map Architect (AI)",
	},
];

export default function SidebarResources({
	onOpenPlayerQuestions,
}: {
	onOpenPlayerQuestions: () => void;
}) {
	return (
		<div className="Sidebar__section Sidebar__section__resources">
			<h2 className="Sidebar__sectionTitle">
				<span>{lang.t("Useful resources")}</span>
			</h2>
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
				<Tooltip delay={1200} content={SIDEBAR_SHORTCUT_LABELS.playerQuestions}>
					<button
						type="button"
						className="Sidebar__resource_item"
						onClick={onOpenPlayerQuestions}
					>
						<Icon name="help" size={16} />
						<span>{lang.t("Player questions")}</span>
					</button>
				</Tooltip>
			</div>
		</div>
	);
}

import type { ReactNode } from "react";
import { Button, Icon } from "../../../../shared/ui/index.js";
import { lang } from "../../../../shared/lib/index.js";
import type { CampaignPageEntity } from "../../model/contracts.ts";
import type { CampaignSessionItem } from "../../model/campaignPagePresentation.ts";

export type CampaignSection = "overview" | "story" | "sessions" | "characters" | "npc" | "locations" | "notes";

interface CampaignOverviewProps {
	sessions: CampaignSessionItem[];
	characters: CampaignPageEntity[];
	npcCount: number;
	locationCount: number;
	description: string;
	onSelectSection: (section: CampaignSection) => void;
	onOpenSession: (session: CampaignSessionItem) => void;
	onCreateSession: () => void;
	renderSessionCard: (session: CampaignSessionItem) => ReactNode;
}

export default function CampaignOverview({ sessions, characters, npcCount, locationCount, description,
	onSelectSection, onOpenSession, onCreateSession, renderSessionCard }: CampaignOverviewProps) {
	const latest = sessions[sessions.length - 1];
	const metrics = [
		{ value: sessions.length, label: lang.t("Sessions in campaign") },
		{ value: characters.length, label: lang.t("Heroes in adventure") },
		{ value: npcCount, label: lang.t("World characters") },
		{ value: locationCount, label: lang.t("Known locations") },
	];
	return (
		<div className="CampaignOverview">
			<section className="CampaignOverview__hero">
				<div className="CampaignOverview__heroContent">
					<p className="WorkspaceEyebrow">{lang.t("Your story continues")}</p>
					<h3>{latest?.name || lang.t("Your next adventure starts here")}</h3>
					<p className="CampaignOverview__description">{description || lang.t("Gather your heroes and write the next chapter.")}</p>
					<div className="CampaignOverview__heroActions">
						<Button variant="primary" onClick={() => latest ? onOpenSession(latest) : onCreateSession()}>
							{lang.t(latest ? "Open latest session" : "New session")}
						</Button>
						<button type="button" className="WorkspaceTextLink" onClick={() => onSelectSection("story")}>{lang.t("Edit campaign story")}</button>
					</div>
				</div>
				<img className="CampaignOverview__journey" src="/design/4-120.svg" width="280" height="160" alt="" />
			</section>
			<div className="CampaignOverview__metrics">
				{metrics.map(({ value, label }) => <div className="CampaignOverview__metric" key={label}>
					<strong>{String(value).padStart(2, "0")}</strong><span>{label}</span>
				</div>)}
			</div>
			<div className="CampaignOverview__dashboard">
				<section className="CampaignOverview__card">
					<header><h3>{lang.t("Recent sessions")}</h3><button type="button" className="WorkspaceTextLink" onClick={() => onSelectSection("sessions")}>{lang.t("All sessions")} →</button></header>
					{sessions.slice(-3).reverse().map(renderSessionCard)}
					{sessions.length === 0 && <p className="muted">{lang.t("No sessions yet. Create your first session.")}</p>}
				</section>
				<section className="CampaignOverview__card">
					<header><h3>{lang.t("Your party")}</h3><button type="button" className="WorkspaceTextLink" onClick={() => onSelectSection("characters")}>{lang.t("View all")} →</button></header>
					{characters.slice(0, 4).map((character, index) => {
						const name = [character.firstName, character.lastName].filter(Boolean).join(" ") || character.name || lang.t("Character");
						const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("");
						const details = [character.race, character.class, character.level ? `${character.level} ${lang.t("Level").toLowerCase()}` : ""].filter(Boolean).map(String).join(" · ");
						return <button type="button" className="CampaignOverview__person" key={character.id ?? character.slug ?? index} onClick={() => onSelectSection("characters")}>
							<span className="CampaignOverview__avatar">{initials}</span><span><strong>{name}</strong><small>{details}</small></span>
						</button>;
					})}
					{characters.length === 0 && <button type="button" className="WorkspaceTextLink" onClick={() => onSelectSection("characters")}>{lang.t("Add your first character")}</button>}
				</section>
			</div>
			<p className="CampaignOverview__footer"><Icon name="check" size={14} />{lang.t("Your adventure is saved locally. Backups are available in the navigation menu.")}</p>
		</div>
	);
}

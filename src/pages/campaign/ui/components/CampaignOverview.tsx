import type { ReactNode } from "react";
import { Button } from "../../../../shared/ui/index.js";
import { renderMentionText } from "../../../../features/entity-link/index.js";
import { getNoteListPreview, lang, type SharedNote } from "../../../../shared/lib/index.js";
import type { CampaignPageEntity } from "../../model/contracts.ts";
import { getCampaignEntityRenderKey, type CampaignSessionItem } from "../../model/campaignPagePresentation.ts";
import type { DomainId } from "../../../../entities/campaign/index.js";

export type CampaignSection = "overview" | "story" | "sessions" | "characters" | "npc" | "locations" | "notes" | "gallery";

interface CampaignOverviewProps {
	sessions: CampaignSessionItem[];
	characters: CampaignPageEntity[];
	notes: SharedNote[];
	description: string;
	onSelectSection: (section: CampaignSection) => void;
	onOpenCharacter: (id: DomainId) => void;
	onOpenSession: (session: CampaignSessionItem) => void;
	onCreateSession: () => void;
	renderSessionCard: (session: CampaignSessionItem) => ReactNode;
}

export default function CampaignOverview({ sessions, characters, notes, description,
	onSelectSection, onOpenCharacter, onOpenSession, onCreateSession, renderSessionCard }: CampaignOverviewProps) {
	const latest = sessions[sessions.length - 1];
	const previewNotes = notes.filter((note) => note.title?.trim() || note.text?.trim()).slice(0, 2);
	return (
		<div className="CampaignOverview">
			<section className="CampaignOverview__hero">
				<div className="CampaignOverview__heroContent">
					<p className="WorkspaceEyebrow">{lang.t("Your story continues")}</p>
					<h3>{latest?.name || lang.t("Your next adventure starts here")}</h3>
					<p className="CampaignOverview__description">{renderMentionText(description || lang.t("Gather your heroes and write the next chapter."))}</p>
					<div className="CampaignOverview__heroActions">
						<Button variant="primary" onClick={() => latest ? onOpenSession(latest) : onCreateSession()}>
							{lang.t(latest ? "Open latest session" : "New session")}
						</Button>
						<button type="button" className="WorkspaceTextLink" onClick={() => onSelectSection("story")}>{lang.t("Edit campaign story")}</button>
					</div>
				</div>
				<img className="CampaignOverview__journey" src="/design/4-120.svg" width="280" height="160" alt="" />
			</section>
			<div className="CampaignOverview__dashboard">
				<div className="CampaignOverview__mainColumn">
				<section className="CampaignOverview__card">
					<header><h3>{lang.t("Recent sessions")}</h3><button type="button" className="WorkspaceTextLink" onClick={() => onSelectSection("sessions")}>{lang.t("All sessions")} →</button></header>
					{sessions.slice(-3).reverse().map(renderSessionCard)}
					{sessions.length === 0 && <p className="muted">{lang.t("No sessions yet. Create your first session.")}</p>}
				</section>
				<section className="CampaignOverview__card CampaignOverview__notes">
					<header><h3>{lang.t("Campaign notes")}</h3></header>
					{previewNotes.length ? previewNotes.map((note) => (
						<div className="CampaignOverview__note" key={note.id}>
							{note.title?.trim() && <strong>{note.title}</strong>}
							{note.text?.trim() && <p>{renderMentionText(getNoteListPreview({ text: note.text }).text)}</p>}
						</div>
					)) : <p className="muted">{lang.t("No campaign notes yet.")}</p>}
					<Button variant="ghost" icon="edit" onClick={() => onSelectSection("notes")}>{lang.t("Edit notes")}</Button>
				</section>
				</div>
				<section className="CampaignOverview__card">
					<header><h3>{lang.t("Your party")}</h3><button type="button" className="WorkspaceTextLink" onClick={() => onSelectSection("characters")}>{lang.t("View all")} →</button></header>
					{characters.slice(0, 4).map((character, index) => {
						const name = [character.firstName, character.lastName].filter(Boolean).join(" ") || character.name || lang.t("Character");
						const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("");
						const details = [character.race, character.class, character.level ? `${character.level} ${lang.t("Level").toLowerCase()}` : ""].filter(Boolean).map(String).join(" · ");
						return <button type="button" className="CampaignOverview__person" key={character.id ?? character.slug ?? index} onClick={() => onOpenCharacter(getCampaignEntityRenderKey(character, index))}>
							<span className="CampaignOverview__avatar">{initials}</span><span><strong>{name}</strong><small>{details}</small></span>
						</button>;
					})}
					{characters.length === 0 && <button type="button" className="WorkspaceTextLink" onClick={() => onSelectSection("characters")}>{lang.t("Add your first character")}</button>}
				</section>
			</div>
		</div>
	);
}

import type { ReactNode } from "react";

import { lang } from "../../../../shared/lib/index.js";
import { Button, DraggableList } from "../../../../shared/ui/index.js";
import type { CampaignSessionItem } from "../../model/campaignPagePresentation.ts";

interface CampaignSessionsSectionProps {
	canReorderSessions: boolean;
	filteredSessions: CampaignSessionItem[];
	onCreateSession: () => void;
	onReorder: (sessions: CampaignSessionItem[]) => void;
	onReorderDrop: (sessions: CampaignSessionItem[]) => void;
	onSessionSearchChange: (value: string) => void;
	renderSessionCard: (session: CampaignSessionItem) => ReactNode;
	sessionSearch: string;
}

export default function CampaignSessionsSection({
	canReorderSessions,
	filteredSessions,
	onCreateSession,
	onReorder,
	onReorderDrop,
	onSessionSearchChange,
	renderSessionCard,
	sessionSearch,
}: CampaignSessionsSectionProps) {
	return (
		<aside className="CampaignView__sessionsPane" id="campaign-sessions">
			<div className="CampaignView__sessionsPaneHeader">
				<h3>{lang.t("Sessions")}</h3>
				<Button
					variant="create"
					onClick={onCreateSession}
					icon="plus"
					size={Button.SIZES.SMALL}
				>
					{lang.t("New session")}
				</Button>
			</div>
			<div className="CampaignView__sessionsPaneControls">
				<input
					className="CampaignView__sessionSearch"
					placeholder={lang.t("Search sessions...")}
					value={sessionSearch}
					onChange={(event) => onSessionSearchChange(event.target.value)}
				/>
			</div>
			<div className="CampaignView__sessionsPaneList">
				{canReorderSessions ? (
					<DraggableList
						items={filteredSessions}
						onReorder={onReorder}
						onDrop={onReorderDrop}
						keyExtractor={(session) => session.fileName}
						renderItem={renderSessionCard}
					/>
				) : (
					<div className="CampaignView__sessions">
						{filteredSessions.map(renderSessionCard)}
					</div>
				)}
				{filteredSessions.length === 0 && (
					<div className="muted CampaignView__emptySessions">
						{lang.t("No sessions found.")}
					</div>
				)}
			</div>
		</aside>
	);
}

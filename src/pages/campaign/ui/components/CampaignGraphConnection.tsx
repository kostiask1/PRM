import { renderMentionText } from "../../../../features/entity-link/index.js";
import {
	getCampaignGraphNodeTypeClass,
	type CampaignGraphConnectionPresentation,
} from "../../model/campaignGraphPresentation.ts";

interface CampaignGraphConnectionProps {
	presentation: CampaignGraphConnectionPresentation;
	onActivate: () => void;
}

export function CampaignGraphConnection({
	presentation,
	onActivate,
}: CampaignGraphConnectionProps) {
	return (
		<button
			type="button"
			className="CampaignNotesGraph__connection"
			onClick={onActivate}
		>
			<span
				className={`CampaignNotesGraph__dot ${getCampaignGraphNodeTypeClass(presentation.node.type)}`}
			/>
			<span className="CampaignNotesGraph__connectionText">
				<strong>{renderMentionText(presentation.node.label)}</strong>
				<span>{renderMentionText(presentation.metaText)}</span>
			</span>
		</button>
	);
}

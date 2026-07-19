import type { CampaignPageCampaign, CampaignPageEntity, CampaignSessionDetails, CampaignGraphNoteSave } from "../../model/contracts.ts";
import type { SessionRecord } from "../../../../entities/session/index.js";
import type { SharedNote } from "../../../../shared/lib/index.js";

export interface CampaignNotesGraphProps {
	campaign: CampaignPageCampaign;
	description: string;
	notes: SharedNote[];
	characters: CampaignPageEntity[];
	npcs: CampaignPageEntity[];
	locations: CampaignPageEntity[];
	sessions: SessionRecord[];
	sessionDetails: CampaignSessionDetails;
	isLoading: boolean;
	error: string;
	onLoadSessionDetails: () => void | Promise<void>;
	onSaveNote: (request: CampaignGraphNoteSave) => void | Promise<void>;
	onOpenSession: (fileName: string) => void;
}

export default function CampaignNotesGraph(props: CampaignNotesGraphProps): import("react").ReactNode;

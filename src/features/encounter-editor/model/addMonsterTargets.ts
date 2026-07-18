import type { CampaignRecord } from "../../../entities/campaign/index.js";
import type {
	EncounterRecord,
	SessionDomainId,
	SessionRecord,
} from "../../../entities/session/index.js";

export interface EncounterTargetCampaign extends CampaignRecord {
	completed?: boolean;
}

export interface EncounterTarget extends EncounterRecord {
	id: SessionDomainId;
}

export interface EncounterTargetSession extends SessionRecord {
	fileName: string;
	data?: {
		encounters?: EncounterTarget[];
	} & Record<string, unknown>;
}

export interface EncounterTargetSessionGroup {
	session: EncounterTargetSession;
	encounters: EncounterTarget[];
}

export interface EncounterTargetCampaignGroup {
	campaign: EncounterTargetCampaign;
	sessions: EncounterTargetSessionGroup[];
}

interface UnknownRecord {
	[key: string]: unknown;
}

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null;
}

function isCampaign(value: unknown): value is EncounterTargetCampaign {
	return (
		isRecord(value) &&
		typeof value.slug === "string" &&
		typeof value.name === "string"
	);
}

export function normalizeActiveEncounterCampaigns(
	value: unknown,
): EncounterTargetCampaign[] {
	return (Array.isArray(value) ? value : []).filter(
		(campaign): campaign is EncounterTargetCampaign =>
			isCampaign(campaign) && !campaign.completed,
	);
}

export function normalizeEncounterSessionSummaries(
	value: unknown,
): EncounterTargetSession[] {
	return (Array.isArray(value) ? value : []).filter(
		(session): session is EncounterTargetSession =>
			isRecord(session) &&
			typeof session.fileName === "string" &&
			typeof session.name === "string",
	);
}

export function normalizeEncounterSession(
	value: unknown,
): EncounterTargetSession | null {
	if (
		!isRecord(value) ||
		typeof value.fileName !== "string" ||
		typeof value.name !== "string"
	) {
		return null;
	}

	const data = isRecord(value.data) ? value.data : {};
	const encounters = (Array.isArray(data.encounters) ? data.encounters : [])
		.filter(
			(encounter): encounter is UnknownRecord =>
				isRecord(encounter) &&
				encounter.id !== null &&
				encounter.id !== undefined,
		)
		.map((encounter) => encounter as EncounterTarget);

	return {
		...value,
		name: value.name,
		fileName: value.fileName,
		data: { ...data, encounters },
	};
}

export function buildEncounterTargetCampaignGroup(
	campaign: EncounterTargetCampaign,
	sessions: unknown,
): EncounterTargetCampaignGroup {
	const sessionGroups = (Array.isArray(sessions) ? sessions : [])
		.map(normalizeEncounterSession)
		.filter((session): session is EncounterTargetSession => session !== null)
		.map((session) => ({
			session,
			encounters: session.data?.encounters || [],
		}))
		.filter((group) => group.encounters.length > 0);

	return { campaign, sessions: sessionGroups };
}

export function createEncounterTargetId(
	campaignSlug: string,
	fileName: string,
	encounterId: SessionDomainId,
): string {
	return `${campaignSlug}:${fileName}:${encounterId}`;
}

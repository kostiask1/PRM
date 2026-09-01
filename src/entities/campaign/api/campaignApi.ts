import { request, requestBlob } from "../../../shared/api/index.ts";

export type DomainId = string | number;
export type CampaignEntityType = "characters" | "npc" | "locations" | string;

export interface CampaignRecord extends Record<string, unknown> {
	id?: DomainId;
	slug: string;
	name: string;
	order?: number;
}

export interface CampaignEntityRecord extends Record<string, unknown> {
	id?: DomainId;
	slug?: string;
	name?: string;
}

export type CampaignOrder = Record<string, number>;

export const CAMPAIGN_PARTIAL_ARCHIVE_SECTIONS = [
	"sessions",
	"npc",
	"locations",
	"images",
	"aiHistory",
] as const;

export type CampaignPartialArchiveSection =
	(typeof CAMPAIGN_PARTIAL_ARCHIVE_SECTIONS)[number];

export interface CampaignDeleteOptions {
	moveImagesToGeneral?: boolean;
}

export interface CampaignImageStatus {
	hasImages: boolean;
}

export type CampaignBundle = Record<string, unknown>;

export interface CampaignImportResult extends Record<string, unknown> {
	ok: boolean;
	imported: number | Record<string, number>;
	strategy?: string;
	sections?: CampaignPartialArchiveSection[];
}

const campaignPath = (slug: string) =>
	`/campaigns/${encodeURIComponent(slug)}`;
const entityPath = (slug: string, type: CampaignEntityType) =>
	`${campaignPath(slug)}/entities/${encodeURIComponent(type)}`;

export const campaignApi = {
	listCampaigns: () => request<CampaignRecord[]>("/campaigns"),
	createCampaign: (name: string) =>
		request<CampaignRecord>("/campaigns", {
			method: "POST",
			body: JSON.stringify({ name }),
		}),
	updateCampaign: (slug: string, payload: Partial<CampaignRecord>) =>
		request<CampaignRecord>(campaignPath(slug), {
			method: "PATCH",
			body: JSON.stringify(payload),
		}),
	deleteCampaign: (slug: string, options: CampaignDeleteOptions = {}) =>
		request<void>(campaignPath(slug), {
			method: "DELETE",
			body: JSON.stringify(options),
		}),
	campaignHasImages: (slug: string) =>
		request<CampaignImageStatus>(`${campaignPath(slug)}/has-images`),
	exportCampaign: (slug: string) =>
		request<CampaignBundle>(`${campaignPath(slug)}/export`),
	exportCampaignArchive: (slug: string) =>
		requestBlob(`${campaignPath(slug)}/export/archive`),
	exportCampaignPartialArchive: (
		slug: string,
		sections: CampaignPartialArchiveSection[] = [],
	) => {
		const query = new URLSearchParams();
		if (sections.length > 0) query.set("sections", sections.join(","));
		return requestBlob(
			`${campaignPath(slug)}/export/partial-archive?${query.toString()}`,
		);
	},
	importCampaign: (bundle: CampaignBundle) =>
		request<CampaignImportResult>("/import-all", {
			method: "POST",
			body: JSON.stringify(bundle),
		}),
	importCampaignPartialArchive: (
		slug: string,
		file: Blob,
		sections: CampaignPartialArchiveSection[] = [],
	) => {
		const formData = new FormData();
		formData.append("archive", file);
		if (sections.length > 0) formData.append("sections", sections.join(","));
		return request<CampaignImportResult>(
			`${campaignPath(slug)}/import/partial-archive`,
			{
				method: "POST",
				body: formData,
			},
		);
	},
	reorderCampaigns: (orders: CampaignOrder) =>
		request<CampaignRecord[]>("/campaigns/reorder", {
			method: "POST",
			body: JSON.stringify({ orders }),
		}),
	getEntities: (
		slug: string,
		type: CampaignEntityType,
		options: RequestInit = {},
	) =>
		request<CampaignEntityRecord[]>(entityPath(slug, type), options),
	createEntity: (
		slug: string,
		type: CampaignEntityType,
		payload: CampaignEntityRecord,
	) =>
		request<CampaignEntityRecord>(entityPath(slug, type), {
			method: "POST",
			body: JSON.stringify(payload),
		}),
	updateEntity: (
		slug: string,
		type: CampaignEntityType,
		entitySlug: string,
		payload: Partial<CampaignEntityRecord>,
	) =>
		request<CampaignEntityRecord>(
			`${entityPath(slug, type)}/${encodeURIComponent(entitySlug)}`,
			{ method: "PATCH", body: JSON.stringify(payload) },
		),
	replaceEntities: (
		slug: string,
		type: CampaignEntityType,
		entities: CampaignEntityRecord[],
	) =>
		request<CampaignEntityRecord[]>(entityPath(slug, type), {
			method: "PUT",
			body: JSON.stringify({ entities }),
		}),
	deleteEntity: (slug: string, type: CampaignEntityType, entitySlug: string) =>
		request<void>(`${entityPath(slug, type)}/${encodeURIComponent(entitySlug)}`, {
			method: "DELETE",
		}),
	moveEntity: (
		slug: string,
		type: CampaignEntityType,
		entitySlug: string,
		targetType: CampaignEntityType,
	) =>
		request<CampaignEntityRecord>(
			`${entityPath(slug, type)}/${encodeURIComponent(entitySlug)}/move`,
			{ method: "POST", body: JSON.stringify({ targetType }) },
		),
};

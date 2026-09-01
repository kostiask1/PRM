import {
	CardNoteModel,
	type CardEntity,
	type CardNote,
} from "./cardNoteModel.ts";

export interface LocationData extends CardEntity {
	id?: number | string;
	slug?: string;
	name?: string;
	title?: string;
	description?: string;
	notes?: CardNote[];
	collapsed?: boolean;
	isNotesCollapsed?: boolean;
	imageUrl?: string | null;
}

export default class LocationCardModel extends CardNoteModel<LocationData> {
	location: LocationData;

	constructor(location: LocationData = {}) {
		super();
		this.location = location;
	}

	get entity(): LocationData {
		return this.location;
	}

	get displayName(): string {
		return this.location.name || this.location.title || "";
	}

	get briefMeta(): string {
		const text = String(this.location.description || "")
			.replace(/\s+/g, " ")
			.trim();
		if (text.length <= 120) return text;
		return `${text.slice(0, 117).trim()}...`;
	}
}

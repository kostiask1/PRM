import {
	CardNoteModel,
	type CardEntity,
	type CardNote,
} from "./cardNoteModel.ts";

export interface CharacterData extends CardEntity {
	id?: number | string;
	slug?: string;
	name?: string;
	firstName?: string;
	lastName?: string;
	race?: string;
	class?: string;
	level?: number | string;
	motivation?: string;
	description?: string;
	trait?: string;
	notes?: CardNote[];
	collapsed?: boolean;
	isNotesCollapsed?: boolean;
	imageUrl?: string | null;
	_isNew?: boolean;
}

export default class CharacterCardModel extends CardNoteModel {
	character: CharacterData;

	constructor(character: CharacterData = {}) {
		super();
		this.character = character;
	}

	get entity(): CharacterData {
		return this.character;
	}

	get displayName(): string {
		return this.character.firstName || this.character.name || "New character";
	}

	get fullName(): string {
		return `${this.character.firstName || ""} ${this.character.lastName || ""}`.trim();
	}

	get level(): number | "" {
		return this.character.level === ""
			? ""
			: Number(this.character.level || 1);
	}

	get briefMeta(): string {
		const race = this.character.race || "";
		const className = this.character.class || "";

		return [race && className ? `${race} |` : race, className]
			.filter(Boolean)
			.join(" ")
			.trim();
	}

	get description(): string {
		return this.character.description || "";
	}

	get trait(): string {
		return this.character.trait || "";
	}

	static getLevelOptions(max = 20): number[] {
		return Array.from({ length: max }, (_, index) => index + 1);
	}
}

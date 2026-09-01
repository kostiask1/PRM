import {
	upsertNoteById,
	type SharedNote,
} from "../../../shared/lib/index.js";

export interface CardNote extends SharedNote {
	title: string;
	text: string;
	collapsed: boolean;
}

export interface CardEntity extends Record<string, unknown> {
	notes?: CardNote[];
}

function getCardNotes(entity: CardEntity = {}): CardNote[] {
	return Array.isArray(entity.notes) ? [...entity.notes] : [];
}

function withCardField<Entity extends CardEntity>(
	entity: Entity,
	field: string,
	value: unknown,
): Entity {
	return {
		...entity,
		[field]: value,
	} as Entity;
}

function withUpdatedCardNote(
	notes: CardNote[],
	noteId: string | number,
	updates: Partial<CardNote> = {},
): CardNote[] {
	return upsertNoteById(notes, noteId, updates);
}

function withDeletedCardNote(
	notes: CardNote[],
	noteId: string | number,
): CardNote[] {
	return notes.filter((note) => note.id !== noteId);
}

function toggleCardNoteCollapse(
	notes: CardNote[],
	noteId: string | number,
): CardNote[] {
	return notes.map((note) =>
		note.id === noteId ? { ...note, collapsed: !note.collapsed } : note,
	);
}

export class CardNoteModel<Entity extends CardEntity = CardEntity> {
	get entity(): Entity {
		return {} as Entity;
	}

	get notes(): CardNote[] {
		return getCardNotes(this.entity);
	}

	withField(field: string, value: unknown): Entity {
		return withCardField(this.entity, field, value);
	}

	withUpdatedNote(
		noteId: string | number,
		updates: Partial<CardNote> = {},
	): CardNote[] {
		return withUpdatedCardNote(this.notes, noteId, updates);
	}

	withDeletedNote(noteId: string | number): CardNote[] {
		return withDeletedCardNote(this.notes, noteId);
	}

	toggleNoteCollapse(noteId: string | number): CardNote[] {
		return toggleCardNoteCollapse(this.notes, noteId);
	}
}

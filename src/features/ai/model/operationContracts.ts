export type AiOperationKind =
	| "create"
	| "update"
	| "delete"
	| "appendNote"
	| "updateNote"
	| "deleteNote"
	| "moveScope";

export type AiOperationEntity =
	| "campaign"
	| "session"
	| "character"
	| "characters"
	| "npc"
	| "npcs"
	| "location"
	| "locations"
	| "faction"
	| "factions"
	| "scene"
	| "scenes"
	| "encounter"
	| "encounters"
	| "monster"
	| "custom-monster"
	| "customMonster";

export type AiEntityScope = "campaign" | "session";
export type AiOperationData = Record<string, unknown>;

interface AiOperationBase {
	op: AiOperationKind;
	entity: AiOperationEntity;
	scope?: AiEntityScope;
	id?: string | number;
	slug?: string;
	name?: string;
	clientId?: string;
	targetClientId?: string;
}

export type AiOperation = AiOperationBase &
	(
		| { op: "create"; data?: AiOperationData; value?: AiOperationData }
		| { op: "update"; patch?: AiOperationData; data?: AiOperationData }
		| { op: "delete" }
		| { op: "appendNote"; note?: string | AiOperationData; data?: AiOperationData }
		| {
				op: "updateNote";
				noteId: string;
				note?: string | AiOperationData;
				data?: AiOperationData;
		  }
		| { op: "deleteNote"; noteId: string }
		| { op: "moveScope"; from: AiEntityScope; to: AiEntityScope }
	);

export interface AiGeneratedContent extends Record<string, unknown> {
	version?: 2;
	operations?: AiOperation[];
}

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
	| "encounter-creature"
	| "monster"
	| "custom-monster"
	| "customMonster";

export type AiEntityScope = "campaign" | "session";
export type AiTargetId = string | number;
export type AiDataObject = Record<string, unknown>;

export interface AiOperationTarget {
	id?: AiTargetId;
	slug?: string;
	name?: string;
	targetClientId?: string;
}

interface AiOperationBase extends AiOperationTarget {
	entity: AiOperationEntity;
	scope?: AiEntityScope;
	clientId?: string;
}

export type AiCreateOperation = AiOperationBase &
	(
		| { op: "create"; data: AiDataObject; value?: AiDataObject }
		| { op: "create"; value: AiDataObject; data?: AiDataObject }
	);

export type AiUpdateOperation = AiOperationBase &
	(
		| { op: "update"; patch: AiDataObject; data?: AiDataObject }
		| { op: "update"; data: AiDataObject; patch?: AiDataObject }
	);

export interface AiDeleteOperation extends AiOperationBase {
	op: "delete";
}

export type AiAppendNoteOperation = AiOperationBase &
	(
		| { op: "appendNote"; note: string | AiDataObject; data?: AiDataObject }
		| { op: "appendNote"; data: AiDataObject; note?: string | AiDataObject }
	);

export interface AiUpdateNoteOperation extends AiOperationBase {
	op: "updateNote";
	noteId: string;
	note?: string | AiDataObject;
	data?: AiDataObject;
}

export interface AiDeleteNoteOperation extends AiOperationBase {
	op: "deleteNote";
	noteId: string;
}

export interface AiMoveScopeOperation extends AiOperationBase {
	op: "moveScope";
	from: AiEntityScope;
	to: AiEntityScope;
}

export type AiOperation =
	| AiCreateOperation
	| AiUpdateOperation
	| AiDeleteOperation
	| AiAppendNoteOperation
	| AiUpdateNoteOperation
	| AiDeleteNoteOperation
	| AiMoveScopeOperation;

export interface AiGeneratedContent {
	version: 2;
	operations: AiOperation[];
}

export interface AiContractError {
	path: string;
	message: string;
}

export interface AiContractValidationResult {
	valid: boolean;
	errors: AiContractError[];
}

export interface AiContractValidationOptions {
	requireOperations?: boolean;
	requireExplicitEntityScope?: boolean;
}

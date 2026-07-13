import type {
	ReferenceRecord,
	ReferenceRepository,
} from "../application/ports/referenceRepository";

export interface ReferenceStorageAdapter {
	SPELLS_DIR: string;
	exists(path: string): Promise<boolean>;
	readJson(path: string): Promise<unknown>;
}

export function getSpellRecords(data: unknown): ReferenceRecord[];
export function createFileReferenceRepository(
	storage: ReferenceStorageAdapter,
): Readonly<ReferenceRepository>;

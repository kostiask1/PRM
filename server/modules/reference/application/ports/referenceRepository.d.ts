export type ReferenceRecord = Record<string, unknown>;

export interface ReferenceRepository {
	readSpellAggregate(): Promise<{
		exists: boolean;
		spells: ReferenceRecord[];
	}>;
	readSpellIndex(): Promise<Record<string, string> | null>;
	readSpellFile(fileName: string): Promise<ReferenceRecord[]>;
	readReferenceFile(fileName: string): Promise<unknown | null>;
}

export function createReferenceRepositoryPort(
	implementation: ReferenceRepository,
): Readonly<ReferenceRepository>;

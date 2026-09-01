export interface MonsterRecord extends Record<string, unknown> {
	name?: string;
	source?: string;
}

export interface FavoriteMonsterRef extends Record<string, unknown> {
	name?: string;
	source?: string;
}

export interface BestiaryRepository {
	getIndex(): Promise<Map<string, MonsterRecord>>;
	readCustomMonsters(): Promise<MonsterRecord[]>;
	writeCustomMonsters(monsters: MonsterRecord[]): Promise<unknown>;
	readFavorites(): Promise<FavoriteMonsterRef[]>;
	writeFavorites(favorites: FavoriteMonsterRef[]): Promise<unknown>;
	readAllMonsters(): Promise<{ exists: boolean; monsters: MonsterRecord[] }>;
	listSourceFiles(): Promise<string[]>;
	readLegendaryGroups(): Promise<Record<string, unknown>[]>;
	readSourceMonsters(source: string): Promise<{
		fileSource: string;
		monsters: MonsterRecord[];
	} | null>;
}

export function createBestiaryRepositoryPort(
	implementation: BestiaryRepository,
): Readonly<BestiaryRepository>;

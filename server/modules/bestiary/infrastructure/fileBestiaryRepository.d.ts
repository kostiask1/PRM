import type {
	BestiaryRepository,
	FavoriteMonsterRef,
	MonsterRecord,
} from "../application/ports/bestiaryRepository";

export interface BestiaryStorageAdapter {
	BESTIARY_DIR: string;
	exists(path: string): Promise<boolean>;
	readJson(path: string): Promise<unknown>;
	getBestiaryIndex(): Promise<Map<string, MonsterRecord>>;
	readCustomBestiaryMonsters(): Promise<MonsterRecord[]>;
	writeCustomBestiaryMonsters(monsters: MonsterRecord[]): Promise<unknown>;
	readFavorites(): Promise<FavoriteMonsterRef[]>;
	writeFavorites(favorites: FavoriteMonsterRef[]): Promise<unknown>;
}

export function createFileBestiaryRepository(
	storage: BestiaryStorageAdapter,
): Readonly<BestiaryRepository>;

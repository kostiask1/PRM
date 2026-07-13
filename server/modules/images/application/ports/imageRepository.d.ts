export interface ImageLocation {
	slug: string;
	category: string;
	subcategory?: string;
}

export interface ImageQuery extends Record<string, unknown> {
	source?: string;
	category?: string;
	subcategory?: string;
	categories?: string[];
	ignoreSourcesList?: string[];
	search?: string;
	recursive?: boolean;
}

export interface ImageRecord extends Record<string, unknown> {
	name?: string;
	path?: string;
	url?: string;
}

export interface ImageRepository {
	ensureUploadDirectory(location: ImageLocation): Promise<string> | string;
	resolveUploadFileName(location: ImageLocation, originalName: string): Promise<string> | string;
	list(slug: string, category: string, subcategory?: string): Promise<ImageRecord[]>;
	stats(query: ImageQuery): Promise<Record<string, unknown>>;
	listBestiaryTokens(query: ImageQuery): Promise<ImageRecord[]>;
	search(query: ImageQuery): Promise<ImageRecord[]>;
	listSubcategories(
		slug: string,
		category: string,
		parent?: string,
		options?: { includeMeta?: boolean },
	): Promise<unknown[]>;
	createSubcategory(location: ImageLocation): Promise<void> | void;
	renameImage(
		slug: string,
		category: string,
		subcategory: string | undefined,
		oldName: string,
		newName: string,
	): Promise<unknown>;
	renameSubcategory(
		slug: string,
		category: string,
		oldName: string,
		newName: string,
	): Promise<unknown>;
	move(items: string[], source: ImageLocation, destination: ImageLocation): Promise<unknown>;
	delete(items: string[], source: ImageLocation, options?: Record<string, unknown>): Promise<unknown>;
}

export function createImageRepositoryPort(
	implementation: ImageRepository,
): Readonly<ImageRepository>;

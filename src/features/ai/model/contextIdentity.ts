export interface AiContextIdentityEntity extends Record<string, unknown> {
	id?: string | number;
	slug?: string;
	name?: string;
	title?: string;
	firstName?: string;
	first_name?: string;
	lastName?: string;
	last_name?: string;
}

type ContextIdentityPolicy = (
	entity: AiContextIdentityEntity,
) => unknown;

function normalizeContextIdentity(value: unknown): string {
	if (value === null || value === undefined) return "";
	return String(value).trim();
}

function getFirstContextIdentity(
	entity: AiContextIdentityEntity,
	policies: readonly ContextIdentityPolicy[],
): string {
	for (const policy of policies) {
		const identity = normalizeContextIdentity(policy(entity));
		if (identity) return identity;
	}
	return "";
}

const FIRST_NAME_POLICIES: ContextIdentityPolicy[] = [
	(entity) => entity.firstName,
	(entity) => entity.first_name,
];

const LAST_NAME_POLICIES: ContextIdentityPolicy[] = [
	(entity) => entity.lastName,
	(entity) => entity.last_name,
];

function getCharacterFullName(entity: AiContextIdentityEntity): string {
	const firstName = getFirstContextIdentity(entity, FIRST_NAME_POLICIES);
	const lastName = getFirstContextIdentity(entity, LAST_NAME_POLICIES);
	return [firstName, lastName].filter(Boolean).join(" ");
}

const CHARACTER_CONTEXT_KEY_POLICIES: ContextIdentityPolicy[] = [
	(entity) => entity.slug,
	(entity) => entity.id,
	getCharacterFullName,
	(entity) => entity.name,
	(entity) => entity.title,
];

const LOCATION_CONTEXT_KEY_POLICIES: ContextIdentityPolicy[] = [
	(entity) => entity.slug,
	(entity) => entity.id,
	(entity) => entity.name,
];

export function getAiCharacterContextKey(
	entity: AiContextIdentityEntity,
): string {
	return getFirstContextIdentity(entity, CHARACTER_CONTEXT_KEY_POLICIES);
}

export function getAiLocationContextKey(
	entity: AiContextIdentityEntity,
): string {
	return getFirstContextIdentity(entity, LOCATION_CONTEXT_KEY_POLICIES);
}

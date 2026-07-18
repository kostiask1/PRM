import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
	bestiaryApi,
	MonsterStatBlockModel,
	type BestiaryFavorite,
	type BestiaryMonster,
} from "../../../entities/bestiary/index.js";
import { formatSourceLabel } from "../../../entities/reference/index.js";
import type { CampaignRecord } from "../../../entities/campaign/index.js";
import { spellApi } from "../../../entities/spell/index.js";
import { AddMonsterToEncounterModalContent } from "../../../features/encounter-editor/ui/index.js";
import { parseRollsAndSpells, renderRecursiveContent } from "../../../features/rich-content/index.js";
import { lang } from "../../../shared/lib/index.js";
import {
	openModalRequest,
	requestDiceRollAction,
	useAppDispatch,
	useAppSelector,
} from "../../../shared/model/index.js";
import { classNames } from "../../../shared/lib/index.js";
import { highlightText } from "../../../shared/ui/index.js";
import "../../../assets/components/MonsterStatBlock.css";
import {
	getChangedFieldClass,
	getMonsterContentArray,
	getMonsterEntries,
	getMonsterMutationKey,
	getMonsterSpellcastingEntries,
	getMonsterTokenSources,
	getSenseTextParts,
	getTokenDragPayload,
	getUploadedTokenUrl,
	groupMonsterSpellsByLevel,
	loadMonsterSpells,
	shouldShowMonsterTokenDropzone,
	type LoadedMonsterSpell,
	type MonsterHighlightFields,
} from "../model/monsterStatBlockPresentation.ts";
import {
	LegacySpellcastingSection,
	MonsterAbilities,
	MonsterActionList,
	MonsterContentSection,
	MonsterHeaderDetails,
	MonsterTokenSection,
	StructuredSpellcastingSection,
	renderSenseParts,
	type RenderHelpers,
} from "./MonsterStatBlockSections.tsx";

const SPELL_CACHE = new Map<string, LoadedMonsterSpell>();

export interface MonsterStatBlockProps {
	monster: BestiaryMonster;
	onNameClick?: (monster: BestiaryMonster) => void;
	nameTitle?: ReactNode;
	onFavoriteChange?: Dispatch<SetStateAction<BestiaryFavorite[]>>;
	favoriteActive?: boolean | null;
	tokenImageOverrideUrl?: string | null;
	layoutMode?: "single" | "grid" | "columns" | string;
	showFavoriteAction?: boolean;
	showAddToEncounterPicker?: boolean;
	allowTokenUpload?: boolean;
	tokenUploadCampaignSlug?: string;
	onTokenImageChange?: (monster: BestiaryMonster, imageUrl: string | null) => void;
	onAddToEncounter?: (monster: BestiaryMonster) => void;
	onAiAction?: (monster: BestiaryMonster) => void;
	onDelete?: (monster: BestiaryMonster) => void;
	onFieldEdit?: (monster: BestiaryMonster) => void;
	searchHighlight?: string;
	highlightFields?: MonsterHighlightFields | null;
}

function getStringField(monster: BestiaryMonster, field: string): string {
	const value = monster[field];
	return typeof value === "string" ? value : "";
}

function isMatchingFavorite(
	favorite: BestiaryFavorite,
	effectiveName: string,
	source: string,
): boolean {
	return favorite.name === effectiveName && favorite.source?.toUpperCase() === source.toUpperCase();
}

function isCampaignRecord(value: unknown): value is CampaignRecord {
	if (!value || typeof value !== "object") return false;
	const campaign = value as Record<string, unknown>;
	return typeof campaign.slug === "string" && typeof campaign.name === "string";
}

export default function MonsterStatBlock({
	monster,
	onNameClick,
	nameTitle,
	onFavoriteChange,
	favoriteActive = null,
	tokenImageOverrideUrl = null,
	layoutMode = "single",
	showFavoriteAction = true,
	showAddToEncounterPicker = false,
	allowTokenUpload = true,
	tokenUploadCampaignSlug = "general",
	onTokenImageChange,
	onAddToEncounter,
	onAiAction,
	onDelete,
	onFieldEdit,
	searchHighlight = "",
	highlightFields = null,
}: MonsterStatBlockProps) {
	const dispatch = useAppDispatch();
	const campaigns = useAppSelector((store) => store.campaigns.items);
	const [hasImageError, setHasImageError] = useState(false);
	const [spells, setSpells] = useState<LoadedMonsterSpell[]>([]);
	const [loadingSpells, setLoadingSpells] = useState(false);
	const [isFavorite, setIsFavorite] = useState(false);
	const [customTokenUrl, setCustomTokenUrl] = useState(getStringField(monster, "imageUrl"));
	const [isReplacingToken, setIsReplacingToken] = useState(false);

	const model = useMemo(() => new MonsterStatBlockModel(monster), [monster]);
	const effectiveName = model.effectiveName;
	const source = getStringField(monster, "source");
	const sourceLabel = formatSourceLabel(source);
	const referenceRenderOptions = useMemo(() => ({ creatureSourceFallback: source }), [source]);
	const helpers: RenderHelpers = {
		highlight: (value) => highlightText(String(value ?? ""), searchHighlight),
		renderContent: (content) => renderRecursiveContent(content, searchHighlight, referenceRenderOptions),
		renderActionName: (content) => renderRecursiveContent(content, searchHighlight, { ...referenceRenderOptions, disableNonRechargeRolls: true }),
		renderInlineText: (text) => parseRollsAndSpells(text, searchHighlight, referenceRenderOptions),
		changedClass: (...fields) => getChangedFieldClass(highlightFields, fields),
	};

	useEffect(() => {
		if (favoriteActive !== null) {
			setIsFavorite(Boolean(favoriteActive));
			return;
		}
		if (!showFavoriteAction || !monster.name || !source) {
			setIsFavorite(false);
			return;
		}
		void bestiaryApi.getBestiaryFavorites()
			.then((favorites) => setIsFavorite((favorites ?? []).some((favorite) => isMatchingFavorite(favorite, effectiveName, source))))
			.catch((error: unknown) => console.error("Failed to fetch favorite status", error));
	}, [effectiveName, favoriteActive, monster.name, showFavoriteAction, source]);

	useEffect(() => {
		let cancelled = false;
		setSpells([]);
		const spellList = monster.spell_list;
		if (!Array.isArray(spellList) || spellList.length === 0) return;
		setLoadingSpells(true);
		void loadMonsterSpells(spellList, spellApi.searchSpells, SPELL_CACHE)
			.then((loaded) => { if (!cancelled) setSpells(loaded); })
			.catch((error: unknown) => console.error("Error loading monster spells", error))
			.finally(() => { if (!cancelled) setLoadingSpells(false); });
		return () => { cancelled = true; };
	}, [monster]);

	useEffect(() => {
		setHasImageError(false);
		setCustomTokenUrl(getStringField(monster, "imageUrl"));
		setIsReplacingToken(false);
	}, [monster, tokenImageOverrideUrl]);

	const handleToggleFavorite = async () => {
		try {
			const favorites = await bestiaryApi.toggleBestiaryFavorite(effectiveName, source) ?? [];
			setIsFavorite(favorites.some((favorite) => isMatchingFavorite(favorite, effectiveName, source)));
			onFavoriteChange?.(favorites);
		} catch (error) {
			console.error("Failed to toggle favorite", error);
		}
	};

	const handleAddToEncounter = () => {
		if (onAddToEncounter) {
			onAddToEncounter(monster);
			return;
		}
		openModalRequest({
			title: lang.t("Add to encounter"),
			type: "confirm",
			showFooter: false,
			children: <AddMonsterToEncounterModalContent monster={monster} campaigns={campaigns.filter(isCampaignRecord)} />,
		});
	};

	const handleTokenUpload = async (result: unknown) => {
		const nextUrl = getUploadedTokenUrl(result);
		if (!nextUrl) return;
		setCustomTokenUrl(nextUrl);
		setHasImageError(false);
		if (onTokenImageChange) {
			onTokenImageChange(monster, nextUrl);
			setIsReplacingToken(false);
			return;
		}
		try {
			const updated = await bestiaryApi.updateCustomBestiaryMonster(getMonsterMutationKey(monster, effectiveName), { imageUrl: nextUrl });
			setCustomTokenUrl(updated ? getStringField(updated, "imageUrl") || nextUrl : nextUrl);
			setIsReplacingToken(false);
		} catch (error) {
			console.error("Failed to save custom monster token", error);
		}
	};

	const handleReplaceToken = async () => {
		setCustomTokenUrl("");
		setHasImageError(false);
		setIsReplacingToken(true);
		if (onTokenImageChange) {
			onTokenImageChange(monster, null);
			return;
		}
		try {
			await bestiaryApi.updateCustomBestiaryMonster(getMonsterMutationKey(monster, effectiveName), { imageUrl: null });
		} catch (error) {
			console.error("Failed to clear custom monster token", error);
		}
	};

	const tokenSources = getMonsterTokenSources(monster, customTokenUrl, tokenImageOverrideUrl, model.localTokenSrc, model.externalTokenSrc);
	const showTokenDropzone = shouldShowMonsterTokenDropzone({
		allowTokenUpload,
		hasImageError,
		isReplacingToken,
		localSrc: tokenSources.localSrc,
		isCustomMonster: tokenSources.isCustomMonster,
		hasTokenImageChange: Boolean(onTokenImageChange),
	});
	const spellGroups = groupMonsterSpellsByLevel(spells);
	const spellcastingEntries = getMonsterSpellcastingEntries(monster.spellcasting);
	const isGridLayout = layoutMode === "grid";
	const renderSenses = () => {
		const senses = Array.isArray(monster.senses) ? monster.senses : [monster.senses];
		return senses.map((sense, index) => (
			<span key={index}>
				{typeof sense !== "string" || /\{@sense\s/i.test(sense)
					? helpers.renderContent(sense)
					: renderSenseParts(getSenseTextParts(sense), helpers)}
				{index < senses.length - 1 ? ", " : ""}
			</span>
		));
	};

	return (
		<div className={classNames("MonsterStatBlock", { MonsterStatBlock__grid: isGridLayout })}>
			<div className="MonsterStatBlock__header">
				<MonsterTokenSection
					monster={monster}
					effectiveName={effectiveName}
					sources={tokenSources}
					showDropzone={showTokenDropzone}
					hasImageError={hasImageError}
					allowTokenUpload={allowTokenUpload}
					tokenUploadCampaignSlug={tokenUploadCampaignSlug}
					hasTokenImageChange={Boolean(onTokenImageChange)}
					dragPayload={getTokenDragPayload(tokenSources.externalSrc, String(monster.name ?? ""), effectiveName)}
					onUpload={(result) => { void handleTokenUpload(result); }}
					onCancelReplace={() => setIsReplacingToken(false)}
					onReplace={() => { void handleReplaceToken(); }}
					onImageError={() => setHasImageError(true)}
				/>
				<MonsterHeaderDetails
					monster={monster}
					model={model}
					sourceLabel={sourceLabel}
					isGridLayout={isGridLayout}
					isFavorite={isFavorite}
					showFavoriteAction={showFavoriteAction}
					showAddToEncounterPicker={showAddToEncounterPicker}
					nameTitle={nameTitle}
					onNameClick={onNameClick}
					onFavorite={() => { void handleToggleFavorite(); }}
					onAddToEncounter={handleAddToEncounter}
					onAiAction={onAiAction}
					onDelete={onDelete}
					onFieldEdit={onFieldEdit}
					onRoll={(formula) => dispatch(requestDiceRollAction(formula))}
					helpers={helpers}
					renderSenses={renderSenses}
				/>
			</div>
			{isGridLayout && <div className="MonsterStatBlock__abilities"><MonsterAbilities model={model} helpers={helpers} onRoll={(formula) => dispatch(requestDiceRollAction(formula))} /></div>}
			<LegacySpellcastingSection loading={loadingSpells} groups={spellGroups} helpers={helpers} />
			<StructuredSpellcastingSection entries={spellcastingEntries} helpers={helpers} />
			<MonsterActionList actions={getMonsterEntries(monster.trait)} title="Traits" field="trait" helpers={helpers} />
			<MonsterActionList actions={getMonsterEntries(monster.bonus)} title="Bonus Actions" field="bonus" helpers={helpers} />
			<MonsterActionList actions={getMonsterEntries(monster.action)} title="Actions" field="action" helpers={helpers} />
			<MonsterActionList actions={getMonsterEntries(monster.reaction)} title="Reactions" field="reaction" helpers={helpers} />
			<MonsterActionList actions={getMonsterEntries(monster.legendary)} title="Legendary Actions" field="legendary" helpers={helpers} />
			<MonsterContentSection content={getMonsterContentArray(monster.lairActions)} title="Lair Actions" field="lairActions" helpers={helpers} />
			<MonsterContentSection content={getMonsterContentArray(monster.regionalEffects)} title="Regional Effects" field="regionalEffects" helpers={helpers} />
		</div>
	);
}

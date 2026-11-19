import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SpellCardModel, type SpellData } from "../../../entities/spell/index.js";
import { capitalizeWords, formatSourceLabel, getSourceFullName } from "../../../entities/reference/index.js";
import { RollDice } from "../../../features/dice/index.js";
import { createRichContentRenderers, type RichContentRenderOptions } from "../../../features/rich-content/index.js";
import { createRulesLinkComponent } from "../../../features/rules-reference/index.js";
import { lang } from "../../../shared/lib/index.js";
import { highlightText } from "../../../shared/ui/index.js";
import { getSourcePriority } from "../model/spellsBrowser.ts";
import "../../../assets/components/SpellCard.css";

const SpellCardRulesLink = createRulesLinkComponent({ RollDice });
const spellCardRichContent = createRichContentRenderers({
	RollDice,
	RulesLink: SpellCardRulesLink,
});
const parseSpellCardRollsAndSpells = spellCardRichContent.parseRollsAndSpells;
const renderSpellCardContent = spellCardRichContent.renderRecursiveContent;

export interface SpellCardProps {
	spell?: SpellData | null;
	searchHighlight?: string;
	renderOptions?: RichContentRenderOptions;
}

function SpellProperties({ model, searchHighlight }: { model: SpellCardModel; searchHighlight: string }) {
	const renderInlineInfo = (value: unknown): ReactNode => parseSpellCardRollsAndSpells(String(value || "-"), searchHighlight);
	const properties = [
		[lang.t("Casting time"), model.castingTimeLabel],
		[lang.t("Range"), model.rangeLabel],
		[lang.t("Components"), model.componentsLabel],
		[lang.t("Duration"), model.durationLabel],
		...(model.classesLabel ? [[lang.t("Classes"), model.classesLabel]] : []),
	];
	return <div className="SpellCard__props">{properties.map(([label, value]) => <div key={label}><strong>{label}:</strong>{" "}{renderInlineInfo(value)}</div>)}</div>;
}

export default function SpellCard({ spell, searchHighlight = "", renderOptions = {} }: SpellCardProps) {
	if (!spell) return null;
	const spellData: SpellData = spell;

	const [selectedSource, setSelectedSource] = useState<string | null>(null);

	useEffect(() => {
		setSelectedSource(null);
	}, [spellData.name, spellData.source]);

	const versions = useMemo(() => {
		if (!Array.isArray(spellData.versions) || spellData.versions.length === 0) {
			return null;
		}
		const primary: SpellData = { ...spellData };
		delete primary.versions;
		delete primary.sources;
		const seen = new Set<string>();
		const primarySource = String(primary.source || "").trim().toUpperCase();
		if (primarySource) seen.add(primarySource);
		const list: SpellData[] = [primary];
		for (const rawVersion of spellData.versions) {
			if (!rawVersion || typeof rawVersion !== "object") continue;
			const ver = rawVersion as SpellData;
			const verSource = String(ver.source || "").trim().toUpperCase();
			if (verSource && seen.has(verSource)) continue;
			if (verSource) seen.add(verSource);
			list.push({
				...(primary.name !== undefined && ver.name === undefined
					? { name: primary.name }
					: {}),
				...ver,
			});
		}
		if (list.length <= 1) return null;
		list.sort((a, b) => {
			const priorityDiff = getSourcePriority(b.source) - getSourcePriority(a.source);
			if (priorityDiff !== 0) return priorityDiff;
			return String(a.source || "").localeCompare(String(b.source || ""));
		});
		return list;
	}, [spellData]);

	const activeVersion = useMemo(() => {
		if (!versions || versions.length === 0) return null;
		if (selectedSource) {
			const requestedSource = selectedSource.trim().toUpperCase();
			const match = versions.find(
				(v) => String(v.source || "").trim().toUpperCase() === requestedSource,
			);
			if (match) return match;
		}
		const defaultSource = String(spellData.source || "").trim().toUpperCase();
		return (
			versions.find((v) => String(v.source || "").trim().toUpperCase() === defaultSource) ||
			versions[0]
		);
	}, [versions, selectedSource, spellData.source]);

	if (activeVersion) {
		spell = activeVersion;
	}

	const model = new SpellCardModel(spell, {
		language: lang.getLanguage(),
		translate: (phrase, variables) => lang.t(phrase, variables),
	});
	const metaParts = [model.levelLabel, model.schoolLabel, formatSourceLabel(model.sourceLabel)].filter((part): part is string => Boolean(part));
	
	return (
		<div className="SpellCard">
			<h3 className="SpellCard__name">{highlightText(capitalizeWords(model.displayName), searchHighlight)}</h3>
			<div className="SpellCard__meta">{metaParts.map((part, index) => <span key={`${index}:${part}`}>{index > 0 ? " · " : ""}{highlightText(part, searchHighlight)}</span>)}</div>
			{versions && versions.length > 1 && (
				<div className="SpellCard__sources">
					<span className="SpellCard__sources-label">{lang.t("Source")}:</span>
					<div className="SpellCard__source-pills">
						{versions.map((ver) => {
							const verSource = ver.source || "";
							const isActive = verSource.toUpperCase() === String(spell.source || "").toUpperCase();
							return (
								<button
									key={verSource}
									type="button"
									className={`SpellCard__source-pill ${isActive ? "SpellCard__source-pill--active" : ""}`}
									onClick={() => setSelectedSource(verSource)}
									title={getSourceFullName(verSource)}
								>
									{formatSourceLabel(verSource)}
								</button>
							);
						})}
					</div>
				</div>
			)}
			<SpellProperties model={model} searchHighlight={searchHighlight} />
			<div className="SpellCard__desc">
				{renderSpellCardContent(spell.entries, searchHighlight, renderOptions)}
				{spell.entriesHigherLevel && <div className="SpellCard__higher">{renderSpellCardContent(spell.entriesHigherLevel, searchHighlight, renderOptions)}</div>}
			</div>
		</div>
	);
}

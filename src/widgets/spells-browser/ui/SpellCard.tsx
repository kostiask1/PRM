import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SpellCardModel, type SpellData } from "../../../entities/spell/index.js";
import { capitalizeWords, formatSourceLabel, getSourceFullName } from "../../../entities/reference/index.js";
import { RollDice } from "../../../features/dice/index.js";
import { createRichContentRenderers, type RichContentRenderOptions } from "../../../features/rich-content/index.js";
import { createRulesLinkComponent } from "../../../features/rules-reference/index.js";
import { lang } from "../../../shared/lib/index.js";
import { highlightText } from "../../../shared/ui/index.js";
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
	}, [spellData.name]);

	const versions = useMemo(() => {
		if (Array.isArray(spellData.versions) && spellData.versions.length > 0) {
			return spellData.versions as SpellData[];
		}
		return null;
	}, [spellData.versions]);

	const activeVersion = useMemo(() => {
		if (!versions || versions.length === 0) return null;
		if (selectedSource) {
			const match = versions.find((v) => v.source === selectedSource);
			if (match) return match;
		}
		return versions.find((v) => v.source === spellData.source) || versions[0];
	}, [versions, selectedSource, spellData.source]);

	if (activeVersion) {
		spell = {
			...spell,
			...activeVersion,
		};
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
							const isActive = verSource === spell.source;
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

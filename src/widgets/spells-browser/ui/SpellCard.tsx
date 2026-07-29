import type { ReactNode } from "react";
import { SpellCardModel, type SpellData } from "../../../entities/spell/index.js";
import { capitalizeWords, formatSourceLabel } from "../../../entities/reference/index.js";
import { parseRollsAndSpells, renderRecursiveContent, type RichContentRenderOptions } from "../../../features/rich-content/index.js";
import { lang } from "../../../shared/lib/index.js";
import { highlightText } from "../../../shared/ui/index.js";
import "../../../assets/components/SpellCard.css";

export interface SpellCardProps {
	spell?: SpellData | null;
	searchHighlight?: string;
	renderOptions?: RichContentRenderOptions;
}

function SpellProperties({ model, searchHighlight }: { model: SpellCardModel; searchHighlight: string }) {
	const renderInlineInfo = (value: unknown): ReactNode => parseRollsAndSpells(String(value || "-"), searchHighlight);
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
	const model = new SpellCardModel(spell, {
		language: lang.getLanguage(),
		translate: (phrase, variables) => lang.t(phrase, variables),
	});
	const metaParts = [model.levelLabel, model.schoolLabel, formatSourceLabel(model.sourceLabel)].filter((part): part is string => Boolean(part));
	return (
		<div className="SpellCard">
			<h3 className="SpellCard__name">{highlightText(capitalizeWords(model.displayName), searchHighlight)}</h3>
			<div className="SpellCard__meta">{metaParts.map((part, index) => <span key={`${index}:${part}`}>{index > 0 ? " · " : ""}{highlightText(part, searchHighlight)}</span>)}</div>
			<SpellProperties model={model} searchHighlight={searchHighlight} />
			<div className="SpellCard__desc">
				{renderRecursiveContent(spell.entries, searchHighlight, renderOptions)}
				{spell.entriesHigherLevel && <div className="SpellCard__higher">{renderRecursiveContent(spell.entriesHigherLevel, searchHighlight, renderOptions)}</div>}
			</div>
		</div>
	);
}

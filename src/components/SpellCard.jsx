import "../assets/components/SpellCard.css";
import {
	parseRollsAndSpells,
	renderRecursiveContent,
} from "../renderers/contentRenderer.jsx";
import { capitalizeWords } from "../utils/parser.jsx";
import SpellCardModel from "../models/SpellCardModel.js";
import { lang } from "../services/localization";
import { highlightText } from "../utils/searchHighlight.jsx";
import { formatSourceLabel } from "../utils/sourceNames.js";

export default function SpellCard({
	spell,
	searchHighlight = "",
	renderOptions = {},
}) {
	if (!spell) return null;

	const model = new SpellCardModel(spell, {
		language: lang.getLanguage(),
		translate: (phrase, variables) => lang.t(phrase, variables),
	});
	const renderInlineInfo = (value) =>
		parseRollsAndSpells(String(value || "-"), searchHighlight);
	const metaParts = [
		model.levelLabel,
		model.schoolLabel,
		formatSourceLabel(model.sourceLabel),
	].filter(Boolean);

	return (
		<div className="SpellCard">
			<h3 className="SpellCard__name">
				{highlightText(capitalizeWords(model.displayName), searchHighlight)}
			</h3>
			<div className="SpellCard__meta">
				{metaParts.map((part, index) => (
					<span key={`${index}:${part}`}>
						{index > 0 ? " · " : ""}
						{highlightText(part, searchHighlight)}
					</span>
				))}
			</div>
			<div className="SpellCard__props">
				<div>
					<strong>{lang.t("Casting time")}:</strong>{" "}
					{renderInlineInfo(model.castingTimeLabel)}
				</div>
				<div>
					<strong>{lang.t("Range")}:</strong>{" "}
					{renderInlineInfo(model.rangeLabel)}
				</div>
				<div>
					<strong>{lang.t("Components")}:</strong>{" "}
					{renderInlineInfo(model.componentsLabel)}
				</div>
				<div>
					<strong>{lang.t("Duration")}:</strong>{" "}
					{renderInlineInfo(model.durationLabel)}
				</div>
				{model.classesLabel && (
					<div>
						<strong>{lang.t("Classes")}:</strong>{" "}
						{renderInlineInfo(model.classesLabel)}
					</div>
				)}
			</div>
			<div className="SpellCard__desc">
				{renderRecursiveContent(spell.entries, searchHighlight, renderOptions)}

				{spell.entriesHigherLevel && (
					<div className="SpellCard__higher">
						{renderRecursiveContent(
							spell.entriesHigherLevel,
							searchHighlight,
							renderOptions,
						)}
					</div>
				)}
			</div>
		</div>
	);
}

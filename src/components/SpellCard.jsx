import "../assets/components/SpellCard.css";
import {
	parseRollsAndSpells,
	renderRecursiveContent,
} from "../renderers/contentRenderer.jsx";
import { capitalizeWords } from "../utils/parser.jsx";
import SpellCardModel from "../models/SpellCardModel.js";
import { lang } from "../services/localization";
import { highlightText } from "../utils/searchHighlight.jsx";

export default function SpellCard({ spell, searchHighlight = "" }) {
	if (!spell) return null;

	const model = new SpellCardModel(spell);
	const renderInlineInfo = (value) =>
		parseRollsAndSpells(String(value || "-"), searchHighlight);

	return (
		<div className="SpellCard">
			<h3 className="SpellCard__name">
				{highlightText(capitalizeWords(model.displayName), searchHighlight)}
			</h3>
			<div className="SpellCard__meta">
				{highlightText(model.levelLabel, searchHighlight)},{" "}
				{highlightText(model.schoolLabel, searchHighlight)}
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
				{renderRecursiveContent(spell.entries, searchHighlight)}

				{spell.entriesHigherLevel && (
					<div className="SpellCard__higher">
						{renderRecursiveContent(spell.entriesHigherLevel, searchHighlight)}
					</div>
				)}
			</div>
		</div>
	);
}

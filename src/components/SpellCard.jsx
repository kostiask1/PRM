import "../assets/components/SpellCard.css";
import { renderRecursiveContent } from "../renderers/contentRenderer.jsx";
import { capitalizeWords } from "../utils/parser.jsx";
import SpellCardModel from "../models/SpellCardModel.js";
import { lang } from "../services/localization";

export default function SpellCard({ spell }) {
	if (!spell) return null;

	const model = new SpellCardModel(spell);

	return (
		<div className="SpellCard">
			<h3 className="SpellCard__name">{capitalizeWords(model.displayName)}</h3>
			<div className="SpellCard__meta">
				{model.levelLabel}, {model.schoolLabel}
			</div>
			<div className="SpellCard__props">
				<div>
					<strong>{lang.t("Casting time")}:</strong> {model.castingTimeLabel}
				</div>
				<div>
					<strong>{lang.t("Range")}:</strong> {model.rangeLabel}
				</div>
				<div>
					<strong>{lang.t("Components")}:</strong> {model.componentsLabel}
				</div>
				<div>
					<strong>{lang.t("Duration")}:</strong> {model.durationLabel}
				</div>
				{model.classesLabel && (
					<div>
						<strong>{lang.t("Classes")}:</strong> {model.classesLabel}
					</div>
				)}
			</div>
			<div className="SpellCard__desc">
				{renderRecursiveContent(spell.entries)}

				{spell.entriesHigherLevel && (
					<div className="SpellCard__higher">
						{renderRecursiveContent(spell.entriesHigherLevel)}
					</div>
				)}
			</div>
		</div>
	);
}

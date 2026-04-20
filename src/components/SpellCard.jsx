import "../assets/components/SpellCard.css";
import { capitalizeWords, renderRecursiveContent } from "../utils/parser.jsx";
import SpellCardModel from "../models/SpellCardModel.js";

export default function SpellCard({ spell, onSpellClick }) {
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
					<strong>Час накладання:</strong> {model.castingTimeLabel}
				</div>
				<div>
					<strong>Дистанція:</strong> {model.rangeLabel}
				</div>
				<div>
					<strong>Компоненти:</strong> {model.componentsLabel}
				</div>
				<div>
					<strong>Тривалість:</strong> {model.durationLabel}
				</div>
			</div>
			<div className="SpellCard__desc">
				{renderRecursiveContent(spell.entries, onSpellClick)}

				{spell.entriesHigherLevel && (
					<div className="SpellCard__higher">
						{renderRecursiveContent(spell.entriesHigherLevel, onSpellClick)}
					</div>
				)}
			</div>
			<div className="SpellCard__footer">
				{spell.source && (
					<div>
						<strong>Джерело:</strong> {model.sourceLabel}
					</div>
				)}
			</div>
		</div>
	);
}

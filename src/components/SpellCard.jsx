import "../assets/components/SpellCard.css";
import { capitalizeWords, renderRecursiveContent } from "../utils/parser.jsx";
import SpellCardModel from "../models/SpellCardModel.js";
import { getSpellByName } from "../utils/referencePreview.js";
import useConditionReference from "../hooks/useConditionReference.jsx";

export default function SpellCard({ spell, onSpellClick, onConditionClick }) {
	const { handleConditionClick, handleConditionHover } = useConditionReference({
		externalOnConditionClick: onConditionClick,
		onSpellClick,
		getSpellHoverHandler: () => handleSpellHover,
		modalContentClassName: "SpellCard__desc",
	});
	if (!spell) return null;

	const model = new SpellCardModel(spell);

	const handleSpellHover = async (spellName) => {
		const spell = await getSpellByName(spellName);
		if (!spell) return null;
		return (
			<div className="Tooltip__spell-card">
				<SpellCard
					spell={spell}
					onSpellClick={onSpellClick}
					onConditionClick={handleConditionClick}
				/>
			</div>
		);
	};

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
				{renderRecursiveContent(
					spell.entries,
					onSpellClick,
					handleConditionClick,
					handleSpellHover,
					handleConditionHover,
				)}

				{spell.entriesHigherLevel && (
					<div className="SpellCard__higher">
						{renderRecursiveContent(
							spell.entriesHigherLevel,
							onSpellClick,
							handleConditionClick,
							handleSpellHover,
							handleConditionHover,
						)}
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

import "../assets/components/SpellCard.css";
import { capitalizeWords, renderRecursiveContent } from "../utils/parser.jsx";
import SpellCardModel from "../models/SpellCardModel.js";
import { useModal } from "../context/ModalContext";
import {
	getConditionByName,
	getSpellByName,
} from "../utils/referencePreview.js";

export default function SpellCard({ spell, onSpellClick, onConditionClick }) {
	const modal = useModal();
	if (!spell) return null;

	const model = new SpellCardModel(spell);

	const handleConditionClick = async (name) => {
		if (onConditionClick) {
			onConditionClick(name);
			return;
		}

		try {
			const condition = await getConditionByName(name);
			if (!condition) return;

			modal?.open({
				title: condition.name,
				type: "confirm",
				showFooter: false,
				children: (
					<div className="SpellCard__desc">
						{renderRecursiveContent(
							condition.entries,
							onSpellClick,
							handleConditionClick,
							handleSpellHover,
							handleConditionHover,
						)}
					</div>
				),
			});
		} catch (error) {
			console.error("Failed to open condition details", error);
		}
	};

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

	const handleConditionHover = async (conditionName) => {
		const condition = await getConditionByName(conditionName);
		if (!condition) return null;
		return (
			<div>
				<div className="Tooltip__title">{condition.name}</div>
				{condition.source && <div className="Tooltip__meta">{condition.source}</div>}
				<div className="Tooltip__text">
					{renderRecursiveContent(condition.entries, null, null, null, null)}
				</div>
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

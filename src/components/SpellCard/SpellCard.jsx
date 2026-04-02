import React from "react";
import "./SpellCard.css";
import { parseRollsAndSpells } from "../../utils/diceParser.jsx";

export default function SpellCard({ spell, onSpellClick }) {
	if (!spell) return null;

	return (
		<div className="SpellCard">
			<h3 className="SpellCard__name">{spell.name}</h3>
			<div className="SpellCard__meta">
				{spell.level === 0 ? "Замовляння" : `${spell.level}-й рівень`},{" "}
				{spell.school?.name || spell.school}
			</div>
			<div className="SpellCard__props">
				<div>
					<strong>Час накладання:</strong> {spell.casting_time}
				</div>
				<div>
					<strong>Дистанція:</strong> {spell.range}
				</div>
				<div>
					<strong>Компоненти:</strong>{" "}
					{typeof spell.components === "object"
						? spell.components?.join(", ")
						: spell.components}{" "}
					{spell.material && `(${spell.material})`}
				</div>
				<div>
					<strong>Тривалість:</strong> {spell.duration}{" "}
					{spell.concentration && "(Концентрація)"}
				</div>
			</div>
			<div className="SpellCard__desc">
				{typeof spell.desc === "object" ? (
					spell.desc?.map((p, i) => (
						<div key={i}>{parseRollsAndSpells(p, onSpellClick)}</div>
					))
				) : (
					<div>{parseRollsAndSpells(spell.desc, onSpellClick)}</div>
				)}
				{spell.higher_level?.length > 0 && (
					<div className="SpellCard__higher">
						<strong>На вищих рівнях:&nbsp;</strong>
						{typeof spell.higher_level === "object" ? (
							spell.higher_level.map((p, i) => (
								<React.Fragment key={i}>
									{parseRollsAndSpells(p, onSpellClick)}
								</React.Fragment>
							))
						) : (
							<React.Fragment>
								{parseRollsAndSpells(spell.higher_level, onSpellClick)}
							</React.Fragment>
						)}
					</div>
				)}
			</div>
			<div className="SpellCard__footer">
				<strong>Класи:</strong>{" "}
				{spell.classes
					? spell.classes.map((c) => c.name).join(", ")
					: spell.dnd_class}
			</div>
		</div>
	);
}

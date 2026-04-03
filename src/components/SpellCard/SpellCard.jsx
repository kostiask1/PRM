import React from "react";
import "./SpellCard.css";
import { parseRollsAndSpells, capitalizeWords } from "../../utils/diceParser.jsx";

// Мапінг для скорочень здібностей
const ABILITY_MAP = {
	str: "Strength", dex: "Dexterity", con: "Constitution",
	int: "Intelligence", wis: "Wisdom", cha: "Charisma"
};

// Мапінг для скорочень типів атак
const ATTACK_TYPE_MAP = {
	m: "Melee", r: "Ranged", "m,r": "Melee or Ranged"
};

export default function SpellCard({ spell, onSpellClick }) {
	if (!spell) return null;

	const preprocessText = (text) => {
		if (typeof text !== "string") return text;
		return text
			.replace(/{@h}/gi, "Hit: ")
			.replace(/{@dc\s+(\d+)}/gi, "DC $1")
			.replace(/{@status\s+([^|}]+)(?:\|[^|}]*)?(?:\|([^}]*))?}/gi, (m, g1, g2) => g2 || g1)
			.replace(/{@condition\s+([^|}]+)(?:\|[^|}]*)?(?:\|([^}]*))?}/gi, (m, g1, g2) => g2 || g1)
			.replace(/{@hit\s+([+-]?\d+)}/gi, (m, g1) => (g1.startsWith("+") || g1.startsWith("-") ? g1 : `+${g1}`))
			.replace(/{@dice\s+([^|}]+)(?:\|[^|}]*)?(?:\|([^}]*))?}/gi, (m, g1, g2) => g2 || g1)
			.replace(/{@damage\s+([^|}]+)(?:\|[^|}]*)?(?:\|([^}]*))?}/gi, (m, g1, g2) => g2 || g1)
			.replace(/{@scaledamage\s+([^|}]+)(?:\|[^|}]*)?(?:\|([^}]*))?}/gi, (m, g1, g2) => g2 || g1)
			// Нові парсери для @variantrule, @actSave, @recharge, @atkr
			.replace(/{@actSaveFail}/gi, "On a failure,")
			.replace(/{@actSaveSuccess}/gi, "On a success,")
			.replace(/{@variantrule\s+([^|}]+)(?:\|[^|}]*)?(?:\|([^}]*))?}/gi, (m, g1, g2) => g2 || g1)
			.replace(/{@actSave\s+([a-z]{3})}/gi, (m, g1) => `${ABILITY_MAP[g1] || g1} saving throw`)
			.replace(/{@recharge(?:\s+(\d+))?}/gi, (m, g1) => g1 ? `(Recharge ${g1}-6)` : "(Recharge)")
			.replace(/{@atkr\s+([a-z,]+)}/gi, (m, g1) => `${ATTACK_TYPE_MAP[g1] || g1} Attack: `)
			.replace(/{@(?:creature|skill|item|filter|quickref|book)\s+([^|}]+)(?:\|[^|}]*)?(?:\|([^}]*))?}/gi, (m, g1, g2) => g2 || g1)
			.replace(/{@i\s+([^}]+)}/gi, "*$1*")
			.replace(/{@b\s+([^}]+)}/gi, "**$1**");
	};

	const renderContentRecursive = (content) => {
		if (content === undefined || content === null) return null;
		if (typeof content === "string") {
			return parseRollsAndSpells(preprocessText(content), onSpellClick);
		}
		if (Array.isArray(content)) {
			return content.map((item, idx) => (
				<div key={idx} className="SpellCard__entry-paragraph">
					{renderContentRecursive(item)}
				</div>
			));
		}
		if (typeof content === "object") {
			if (content.type === "entries" || content.type === "section") {
				return (
					<div key={content.name || Math.random()} className="SpellCard__entry-section">
						{content.name && <strong>{content.name}. </strong>}
						{renderContentRecursive(content.entries)}
					</div>
				);
			}
			if (content.type === "list" && content.items) {
				return (
					<ul key={Math.random()} className="SpellCard__list">
						{content.items.map((item, idx) => (
							<li key={idx}>{renderContentRecursive(item)}</li>
						))}
					</ul>
				);
			}
		}
		return null;
	};

	const schoolMap = { 
		"A": "Abjuration (Огородження)", 
		"C": "Conjuration (Виклик)", 
		"D": "Divination (Віщування)", 
		"E": "Enchantment (Очарування)", 
		"I": "Illusion (Ілюзія)", 
		"N": "Necromancy (Некромантія)", 
		"P": "Transmutation (Перетворення)", 
		"V": "Evocation (Втілення)" 
	};

	const formatCastingTime = () => {
		if (!spell.time) return "—";
		return spell.time.map(t => `${t.number} ${t.unit}${t.condition ? ` (${t.condition})` : ""}`).join(", ");
	};

	const formatRange = () => {
		if (!spell.range) return "—";
		const d = spell.range.distance;
		if (!d) return spell.range.type;
		return `${d.amount} ${d.type === 'feet' ? 'фт.' : d.type} (${spell.range.type})`;
	};

	const formatComponents = () => {
		const c = spell.components;
		if (!c) return "—";
		const parts = [];
		if (c.v) parts.push("V");
		if (c.s) parts.push("S");
		if (c.m) {
			const mText = typeof c.m === 'object' ? c.m.text : c.m;
			parts.push(`M (${mText})`);
		}
		return parts.join(", ");
	};

	const formatDuration = () => {
		if (!spell.duration) return "—";
		return spell.duration.map(d => {
			let text = d.type === 'instant' ? "Миттєво" : "";
			if (d.type === 'timed' && d.duration) {
				text = `${d.duration.amount} ${d.duration.type}`;
			}
			if (d.concentration) text = `Концентрація, до ${text}`;
			return text;
		}).join(", ");
	};

	return (
		<div className="SpellCard">
			<h3 className="SpellCard__name">{capitalizeWords(spell.name.split('|')[0])}</h3>
			<div className="SpellCard__meta">
				{spell.level === 0 ? "Замовляння" : `${spell.level}-й рівень`},{" "}
				{schoolMap[spell.school] || spell.school}
			</div>
			<div className="SpellCard__props">
				<div>
					<strong>Час накладання:</strong> {formatCastingTime()}
				</div>
				<div>
					<strong>Дистанція:</strong> {formatRange()}
				</div>
				<div>
					<strong>Компоненти:</strong> {formatComponents()}
				</div>
				<div>
					<strong>Тривалість:</strong> {formatDuration()}
				</div>
			</div>
			<div className="SpellCard__desc">
				{renderContentRecursive(spell.entries)}
				
				{spell.entriesHigherLevel && (
					<div className="SpellCard__higher">
						{renderContentRecursive(spell.entriesHigherLevel)}
					</div>
				)}
			</div>
			<div className="SpellCard__footer">
				{spell.source && <div><strong>Джерело:</strong> {spell.source} (стор. {spell.page})</div>}
			</div>
		</div>
	);
}

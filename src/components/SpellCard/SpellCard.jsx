import "./SpellCard.css";
import {
	capitalizeWords,
	renderRecursiveContent,
} from "../../utils/parser.jsx";

export default function SpellCard({ spell, onSpellClick }) {
	if (!spell) return null;

	const schoolMap = {
		A: "Abjuration (Огородження)",
		C: "Conjuration (Виклик)",
		D: "Divination (Віщування)",
		E: "Enchantment (Очарування)",
		I: "Illusion (Ілюзія)",
		N: "Necromancy (Некромантія)",
		T: "Thaumaturgy (Тауматургія)",
		P: "Transmutation (Перетворення)",
		V: "Evocation (Втілення)",
	};

	const formatCastingTime = () => {
		if (!spell.time) return "—";
		return spell.time
			.map(
				(t) => `${t.number} ${t.unit}${t.condition ? ` (${t.condition})` : ""}`,
			)
			.join(", ");
	};

	const formatRange = () => {
		if (!spell.range) return "—";
		const d = spell.range.distance;
		if (!d) return spell.range.type;
		return `${d.amount || ""} ${d.type === "feet" ? "фт." : d.type} (${spell.range.type})`;
	};

	const formatComponents = () => {
		const c = spell.components;
		if (!c) return "—";
		const parts = [];
		if (c.v) parts.push("V");
		if (c.s) parts.push("S");
		if (c.m) {
			const mText = typeof c.m === "object" ? c.m.text : c.m;
			parts.push(`M (${mText})`);
		}
		return parts.join(", ");
	};

	const formatDuration = () => {
		if (!spell.duration) return "—";
		return spell.duration
			.map((d) => {
				let text = d.type === "instant" ? "Миттєво" : "";
				if (d.type === "timed" && d.duration) {
					text = `${d.duration.amount} ${d.duration.type}`;
				}
				if (d.concentration) text = `Концентрація, до ${text}`;
				return text;
			})
			.join(", ");
	};

	return (
		<div className="SpellCard">
			<h3 className="SpellCard__name">
				{capitalizeWords(spell.name.split("|")[0])}
			</h3>
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
						<strong>Джерело:</strong> {spell.source} (стор. {spell.page})
					</div>
				)}
			</div>
		</div>
	);
}

import { useEffect, useRef, useState } from "react";
import { alert } from "../../../shared/model/index.js";
import "../../../assets/components/RulesLink.css";
import { lang } from "../../../shared/lib/index.js";
import {
	getConditionByName,
	getCreatureByName,
	getDiseaseByName,
	getSenseByName,
	getSkillByName,
	getSpellByName,
	getVariantRuleByName,
} from "../../../entities/reference/index.js";
import {
	resolveConditionInput,
	resolveDiseaseInput,
	resolveSenseInput,
	resolveSkillInput,
	resolveSpellInput,
	resolveVariantRuleInput,
} from "../../../entities/reference/index.js";
import {
	requestRulesReferenceNavigation,
	useAppDispatch,
} from "../../../shared/model/index.js";
import { classNames } from "../../../shared/lib/index.js";
import {
	capitalizeWords,
	formatModifier,
	preprocessTags,
} from "../../../entities/reference/index.js";
import {
	CONTENT_TOKEN_REGEX,
	tokenFromContentMatch,
} from "../../../entities/reference/index.js";
import { getMonsterTypeString } from "../../../entities/bestiary/index.js";
import { MonsterStatBlockModel } from "../../../entities/bestiary/index.js";
import {
	formatSourceLabel,
	getSpellMeta,
} from "../../../entities/reference/index.js";
import { RollDice } from "../../dice/index.js";
import { Tooltip } from "../../../shared/ui/index.js";

function getTaggedDisplayValue(raw) {
	const parts = String(raw || "").split("|");
	return String(parts[2] || parts[0] || "").trim();
}

function parseReferenceParts(raw) {
	const parts = String(raw || "").split("|");
	return {
		name: String(parts[0] || "").trim(),
		source: String(parts[1] || "").trim(),
		label: String(parts[2] || "").trim(),
	};
}

function getSpellReferenceName(spell = {}) {
	const name = String(spell.name || "").trim();
	if (!name) return "";
	const source = String(spell.source || "").trim();
	return source ? `${name}|${source}` : name;
}

function getCreatureReferenceName(creature = {}) {
	const name = String(creature.name || "").trim();
	if (!name) return "";
	const source = String(creature.source || "").trim();
	return source ? `${name}|${source}` : name;
}

function getRechargeThreshold(recharge) {
	const match = String(recharge || "").match(/Recharge\s+(\d+)/i);
	return match ? Number(match[1]) : 6;
}

function getCreatureCr(creature = {}) {
	return creature.cr?.cr !== undefined ? creature.cr.cr : creature.cr;
}

function getCreatureHp(creature = {}) {
	if (creature.hp && typeof creature.hp === "object") {
		return creature.hp.special || creature.hp.average || "";
	}
	return creature.hit_points || "";
}

function getCreatureAc(creature = {}) {
	if (Array.isArray(creature.ac) && creature.ac[0]) {
		const ac = creature.ac[0];
		return typeof ac === "object" ? ac.special || ac.ac || "" : ac;
	}
	if (Array.isArray(creature.armor_class)) return creature.armor_class[0] || "";
	return creature.armor_class || "";
}

function formatFormulaText(text) {
	return String(text || "")
		.replace(/\bsummonSpellLevel\b/g, "spell level")
		.replace(/\bPB\b/g, "proficiency bonus");
}

function formatTooltipText(value) {
	const diceTags = [];
	const protectedText = String(value || "").replace(
		/\{@(?:hit|damage|scaledamage|scaledice|dice|recharge)\s*[^}]*}/gi,
		(match) => {
			const token = `__TOOLTIP_DICE_TAG_${diceTags.length}__`;
			diceTags.push(match);
			return token;
		},
	);
	return preprocessTags(protectedText)
		.replace(
			/\{@(?:spell|creature|condition|status|disease|variantrule|skill|sense|quickref)\s+([^}]+)\}/gi,
			(_, raw) => capitalizeWords(getTaggedDisplayValue(raw)),
		)
		.replace(
			/__TOOLTIP_DICE_TAG_(\d+)__/g,
			(_, index) => diceTags[index] || "",
		);
}

function renderTooltipText(value) {
	const text = formatTooltipText(value);
	const elements = [];
	const regex = new RegExp(
		CONTENT_TOKEN_REGEX.source,
		CONTENT_TOKEN_REGEX.flags,
	);
	let lastIndex = 0;
	let matchIndex = 0;
	let match;

	while ((match = regex.exec(text)) !== null) {
		const token = tokenFromContentMatch(match);
		const start = match.index;
		if (start > lastIndex) {
			elements.push(text.slice(lastIndex, start));
		}

		const {
			fullMatch,
			recharge,
			damageRoll,
			damageRemainder,
			damageLabel,
			diceTag,
			diceFormula,
			diceLabel,
			roll,
			hit,
			hitSuffix,
			displayValue,
		} = token;

		if (recharge) {
			const threshold = getRechargeThreshold(recharge);
			elements.push(
				<RollDice
					key={`tooltip-re-${matchIndex}`}
					formula="1d6"
					context={{
						type: "recharge",
						threshold,
						label: recharge,
					}}
				>
					{recharge}
				</RollDice>,
			);
		} else if (damageRoll || damageRemainder) {
			const displayText = damageLabel || damageRoll;
			if (damageRoll) {
				elements.push(
					<RollDice
						key={`tooltip-d-${matchIndex}`}
						formula={damageRoll.replace(/\s+/g, "")}
					>
						{displayText}
					</RollDice>,
				);
			}
			if (damageRemainder) {
				elements.push(formatFormulaText(damageRemainder));
			}
		} else if (roll) {
			elements.push(
				<RollDice
					key={`tooltip-r-${matchIndex}`}
					formula={roll.replace(/\s+/g, "")}
				>
					{roll}
				</RollDice>,
			);
		} else if (diceTag) {
			const displayText = diceLabel || diceFormula;
			elements.push(
				<RollDice
					key={`tooltip-di-${matchIndex}`}
					formula={String(diceFormula || "").replace(/\s+/g, "")}
				>
					{displayText}
				</RollDice>,
			);
		} else if (hit) {
			const bonus = hit.split(" ")[0];
			const displayHit =
				hit.startsWith("+") || hit.startsWith("-") ? hit : `+${hit}`;
			elements.push(
				<RollDice
					key={`tooltip-h-${matchIndex}`}
					formula={`1d20${formatModifier(parseInt(bonus, 10))}`}
				>
					{`${displayHit}${hitSuffix}`}
				</RollDice>,
			);
		} else if (displayValue) {
			elements.push(displayValue);
		} else {
			elements.push(fullMatch);
		}

		lastIndex = start + fullMatch.length;
		matchIndex += 1;
	}

	if (lastIndex < text.length) {
		elements.push(text.slice(lastIndex));
	}

	return elements.length > 0 ? elements : text;
}

function renderTooltipEntries(content) {
	if (content === undefined || content === null) return null;

	if (typeof content === "string" || typeof content === "number") {
		return renderTooltipText(content);
	}

	if (Array.isArray(content)) {
		return content.map((item, index) => (
			<span key={index}>{renderTooltipEntries(item)}</span>
		));
	}

	if (typeof content === "object") {
		if (content.entry) return renderTooltipEntries(content.entry);

		if (content.type === "list" && Array.isArray(content.items)) {
			return (
				<ul>
					{content.items.map((item, index) => (
						<li key={index}>{renderTooltipEntries(item)}</li>
					))}
				</ul>
			);
		}

		if (
			(content.type === "entries" || content.type === "section") &&
			Array.isArray(content.entries)
		) {
			return (
				<div>
					{content.name && <strong>{content.name}. </strong>}
					{renderTooltipEntries(content.entries)}
				</div>
			);
		}

		if (content.type === "table" && Array.isArray(content.rows)) {
			return (
				<table>
					{content.colLabels && (
						<thead>
							<tr>
								{content.colLabels.map((label, index) => (
									<th key={index}>{renderTooltipEntries(label)}</th>
								))}
							</tr>
						</thead>
					)}
					<tbody>
						{content.rows.map((row, rowIndex) => (
							<tr key={rowIndex}>
								{row.map((cell, cellIndex) => (
									<td key={cellIndex}>{renderTooltipEntries(cell)}</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			);
		}

		return renderTooltipText(JSON.stringify(content));
	}

	return null;
}

export default function RulesLink({
	children,
	name,
	type = "spell",
}) {
	const dispatch = useAppDispatch();
	const [tooltipContent, setTooltipContent] = useState(null);
	const [isLoading, setIsLoading] = useState(false);

	const referenceName = name || String(children || "").trim();
	const referenceKey = `${type}:${referenceName}`;
	const activeTooltipLoadRef = useRef(0);

	useEffect(() => {
		activeTooltipLoadRef.current += 1;
		setTooltipContent(null);
		setIsLoading(false);
	}, [referenceKey]);

	const showLoadError = (error) => {
		console.error("Failed to load rule reference", error);
		dispatch(
			alert({
				title: lang.t("Error"),
				message: error.message || lang.t("Unknown error"),
			}),
		);
	};

	const openSpell = async () => {
		const spell = await resolveSpellInput(referenceName);
		if (!spell) return;

		requestRulesReferenceNavigation("spells", getSpellReferenceName(spell));
	};

	const openCreature = () => {
		const creature = parseReferenceParts(referenceName);
		if (!creature.name) return;

		requestRulesReferenceNavigation("bestiary", getCreatureReferenceName(creature));
	};

	const handleClick = async () => {
		try {
			if (type === "spell") {
				await openSpell();
			} else if (type === "creature") {
				openCreature();
			} else if (type === "condition" || type === "status") {
				const condition = await resolveConditionInput(referenceName);
				if (condition) {
					requestRulesReferenceNavigation("conditions", condition.name);
				}
			} else if (type === "disease") {
				const disease = await resolveDiseaseInput(referenceName);
				if (disease) {
					requestRulesReferenceNavigation("diseases", disease.name);
				}
			} else if (type === "variantrule") {
				const rule = await resolveVariantRuleInput(referenceName);
				if (rule) {
					requestRulesReferenceNavigation("variantrules", rule.name);
				}
			} else if (type === "skill") {
				const skill = await resolveSkillInput(referenceName);
				if (skill) {
					requestRulesReferenceNavigation("skills", skill.name);
				}
			} else if (type === "sense") {
				const sense = await resolveSenseInput(referenceName);
				if (sense) {
					requestRulesReferenceNavigation("senses", sense.name);
				}
			}
		} catch (error) {
			showLoadError(error);
		}
	};

	const loadTooltipContent = async () => {
		if (type === "spell") {
			const spell = await getSpellByName(referenceName);
			if (!spell) return null;
			return (
				<div className="Tooltip__spell_card">
					<div className="Tooltip__title">
						{capitalizeWords(spell.name.split("|")[0])}
					</div>
					<div className="Tooltip__meta">{getSpellMeta(spell)}</div>
					<div className="Tooltip__text">
						{renderTooltipEntries(spell.entries)}
					</div>
				</div>
			);
		}

		if (type === "creature") {
			const creature = await getCreatureByName(referenceName);
			if (!creature) return null;
			const model = new MonsterStatBlockModel(creature);
			const sourceLabel = formatSourceLabel(creature.source);
			const meta = [
				sourceLabel,
				getMonsterTypeString(creature.type),
				getCreatureCr(creature) ? `CR ${getCreatureCr(creature)}` : "",
			].filter(Boolean);

			return (
				<div className="Tooltip__creature_card">
					<img
						className="Tooltip__creature_token"
						src={creature.imageUrl || model.localTokenSrc}
						alt=""
						loading="lazy"
						draggable={false}
						onError={(event) => {
							event.currentTarget.hidden = true;
						}}
					/>
					<div className="Tooltip__creature_body">
						<div className="Tooltip__title">{creature.name}</div>
						{meta.length > 0 && (
							<div className="Tooltip__meta">{meta.join(" • ")}</div>
						)}
						<div className="Tooltip__creature_stats">
							{getCreatureAc(creature) && (
								<span>
									<strong>AC</strong> {getCreatureAc(creature)}
								</span>
							)}
							{getCreatureHp(creature) && (
								<span>
									<strong>HP</strong> {getCreatureHp(creature)}
								</span>
							)}
						</div>
					</div>
				</div>
			);
		}

		if (type === "condition" || type === "status") {
			const condition = await getConditionByName(referenceName);
			if (!condition) return null;
			return (
				<div>
					<div className="Tooltip__title">{condition.name}</div>
					<div className="Tooltip__text">
						{renderTooltipEntries(condition.entries)}
					</div>
				</div>
			);
		}

		if (type === "disease") {
			const disease = await getDiseaseByName(referenceName);
			if (!disease) return null;
			return (
				<div>
					<div className="Tooltip__title">{disease.name}</div>
					{disease.type && <div className="Tooltip__meta">{disease.type}</div>}
					<div className="Tooltip__text">
						{renderTooltipEntries(disease.entries)}
					</div>
				</div>
			);
		}

		if (type === "variantrule") {
			const rule = await getVariantRuleByName(referenceName);
			if (!rule) return null;
			return (
				<div>
					<div className="Tooltip__title">{rule.name}</div>
					<div className="Tooltip__text">
						{renderTooltipEntries(rule.entries)}
					</div>
				</div>
			);
		}

		if (type === "skill") {
			const skill = await getSkillByName(referenceName);
			if (!skill) return null;
			return (
				<div>
					<div className="Tooltip__title">{skill.name}</div>
					{skill.ability && (
						<div className="Tooltip__meta">{skill.ability.toUpperCase()}</div>
					)}
					<div className="Tooltip__text">
						{renderTooltipEntries(skill.entries)}
					</div>
				</div>
			);
		}

		if (type === "sense") {
			const sense = await getSenseByName(referenceName);
			if (!sense) return null;
			return (
				<div>
					<div className="Tooltip__title">{sense.name}</div>
					<div className="Tooltip__text">
						{renderTooltipEntries(sense.entries)}
					</div>
				</div>
			);
		}

		return null;
	};

	const handleMouseEnter = async () => {
		if (tooltipContent || isLoading) return;
		const loadId = activeTooltipLoadRef.current + 1;
		activeTooltipLoadRef.current = loadId;
		setIsLoading(true);
		try {
			const content = await loadTooltipContent();
			if (activeTooltipLoadRef.current === loadId) {
				setTooltipContent(content || null);
			}
		} catch (error) {
			console.error("Failed to load tooltip content", error);
			if (activeTooltipLoadRef.current === loadId) {
				setTooltipContent(null);
			}
		} finally {
			if (activeTooltipLoadRef.current === loadId) {
				setIsLoading(false);
			}
		}
	};

	const resolvedContent =
		tooltipContent ||
		(isLoading ? (
			<div className="Tooltip__text">{lang.t("Loading...")}</div>
		) : null);

	return (
		<Tooltip content={resolvedContent}>
			<span
				className={classNames("RulesLink", type && `RulesLink__${type}`)}
				onClick={handleClick}
				onMouseEnter={handleMouseEnter}
			>
				{children}
			</span>
		</Tooltip>
	);
}

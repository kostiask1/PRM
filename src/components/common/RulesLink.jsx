import { useEffect, useRef, useState } from "react";
import { alert } from "../../actions/app.js";
import "../../assets/components/RulesLink.css";
import { lang } from "../../services/localization.js";
import {
	getConditionByName,
	getDiseaseByName,
	getSenseByName,
	getSkillByName,
	getSpellByName,
	getVariantRuleByName,
} from "../../services/referencePreview.js";
import {
	resolveConditionInput,
	resolveDiseaseInput,
	resolveSenseInput,
	resolveSkillInput,
	resolveSpellInput,
	resolveVariantRuleInput,
} from "../../services/referenceResolvers.js";
import { useAppDispatch } from "../../store/appStore.js";
import classNames from "../../utils/classNames.js";
import { capitalizeWords, preprocessTags } from "../../utils/parser.jsx";
import { openRulesReferenceModal } from "../modals/openRulesReferenceModal.jsx";
import Tooltip from "./Tooltip.jsx";

function getTaggedDisplayValue(raw) {
	const parts = String(raw || "").split("|");
	return String(parts[2] || parts[0] || "").trim();
}

function renderTooltipText(value) {
	return preprocessTags(String(value || ""))
		.replace(
			/\{@(?:spell|condition|status|disease|variantrule|skill|sense|quickref)\s+([^}]+)\}/gi,
			(_, raw) => capitalizeWords(getTaggedDisplayValue(raw)),
		)
		.replace(/\{@(?:hit|dc|damage|dice|recharge)\s+([^}]+)\}/gi, "$1");
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

function getSpellTooltipMeta(spell) {
	const level =
		spell.level_int !== undefined
			? spell.level_int
			: spell.level !== undefined
				? spell.level
				: "";
	const levelLabel =
		level === 0 || String(level) === "0"
			? lang.t("Cantrip")
			: level !== ""
				? lang.t("Level {level}", { level })
				: "";
	return [levelLabel, spell.school, spell.source].filter(Boolean).join(" - ");
}

export default function RulesLink({
	children,
	name,
	type = "spell",
	onNavigate,
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

		if (onNavigate) {
			onNavigate("spells", spell.name);
			return;
		}

		openRulesReferenceModal("spells", spell.name);
	};

	const handleClick = async () => {
		try {
			if (type === "spell") {
				await openSpell();
			} else if (type === "condition" || type === "status") {
				const condition = await resolveConditionInput(referenceName);
				if (condition) {
					if (onNavigate) onNavigate("conditions", condition.name);
					else openRulesReferenceModal("conditions", condition.name);
				}
			} else if (type === "disease") {
				const disease = await resolveDiseaseInput(referenceName);
				if (disease) {
					if (onNavigate) onNavigate("diseases", disease.name);
					else openRulesReferenceModal("diseases", disease.name);
				}
			} else if (type === "variantrule") {
				const rule = await resolveVariantRuleInput(referenceName);
				if (rule) {
					if (onNavigate) onNavigate("variantrules", rule.name);
					else openRulesReferenceModal("variantrules", rule.name);
				}
			} else if (type === "skill") {
				const skill = await resolveSkillInput(referenceName);
				if (skill) {
					if (onNavigate) onNavigate("skills", skill.name);
					else openRulesReferenceModal("skills", skill.name);
				}
			} else if (type === "sense") {
				const sense = await resolveSenseInput(referenceName);
				if (sense) {
					if (onNavigate) onNavigate("senses", sense.name);
					else openRulesReferenceModal("senses", sense.name);
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
					<div className="Tooltip__meta">{getSpellTooltipMeta(spell)}</div>
					<div className="Tooltip__text">
						{renderTooltipEntries(spell.entries)}
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

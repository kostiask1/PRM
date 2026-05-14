import { lazy, Suspense, useState } from "react";
import Tooltip from "./common/Tooltip.jsx";
import "../assets/components/RulesLink.css";
import { lang } from "../services/localization";
import classNames from "../utils/classNames";
import { openModalRequest, useAppDispatch } from "../store/appStore";
import { alert } from "../actions/app";
import {
	getConditionByName,
	getDiseaseByName,
	getSenseByName,
	getSkillByName,
	getSpellByName,
	getVariantRuleByName,
} from "../services/referencePreview.js";
import {
	resolveConditionInput,
	resolveDiseaseInput,
	resolveSenseInput,
	resolveSkillInput,
	resolveSpellInput,
	resolveVariantRuleInput,
} from "../services/referenceResolvers.js";
import { capitalizeWords } from "../utils/parser.jsx";
import { renderRecursiveContent } from "../renderers/contentRenderer.jsx";
import { openConditionsModal } from "./modals/openConditionsModal.jsx";
import { openDiseasesModal } from "./modals/openDiseasesModal.jsx";

const SpellCard = lazy(() => import("./SpellCard"));

export default function RulesLink({
	children,
	name,
	type = "spell",
}) {
	const dispatch = useAppDispatch();
	const [tooltipContent, setTooltipContent] = useState(null);
	const [isLoading, setIsLoading] = useState(false);

	const referenceName = name || String(children || "").trim();

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

		openModalRequest({
			title: capitalizeWords(spell.name.split("|")[0]),
			type: "confirm",
			showFooter: false,
			children: (
				<Suspense fallback={null}>
					<SpellCard spell={spell} />
				</Suspense>
			),
		});
	};

	const openVariantRule = async () => {
		const rule = await resolveVariantRuleInput(referenceName);
		if (!rule) return;

		openModalRequest({
			title: rule.name,
			type: "confirm",
			showFooter: false,
			children: (
				<div className="ConditionsModal__entryContent">
					{renderRecursiveContent(rule.entries)}
				</div>
			),
		});
	};

	const openSkill = async () => {
		const skill = await resolveSkillInput(referenceName);
		if (!skill) return;

		openModalRequest({
			title: skill.name,
			type: "confirm",
			showFooter: false,
			children: (
				<div className="ConditionsModal__entryContent">
					{renderRecursiveContent(skill.entries)}
				</div>
			),
		});
	};

	const openSense = async () => {
		const sense = await resolveSenseInput(referenceName);
		if (!sense) return;

		openModalRequest({
			title: sense.name,
			type: "confirm",
			showFooter: false,
			children: (
				<div className="ConditionsModal__entryContent">
					{renderRecursiveContent(sense.entries)}
				</div>
			),
		});
	};

	const handleClick = async () => {
		try {
			if (type === "spell") {
				await openSpell();
			} else if (type === "condition" || type === "status") {
				const condition = await resolveConditionInput(referenceName);
				if (condition) openConditionsModal(condition.name);
			} else if (type === "disease") {
				const disease = await resolveDiseaseInput(referenceName);
				if (disease) openDiseasesModal(disease.name);
			} else if (type === "variantrule") {
				await openVariantRule();
			} else if (type === "skill") {
				await openSkill();
			} else if (type === "sense") {
				await openSense();
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
				<div className="Tooltip__spell-card">
					<Suspense fallback={null}>
						<SpellCard spell={spell} />
					</Suspense>
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
						{renderRecursiveContent(condition.entries)}
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
						{renderRecursiveContent(disease.entries)}
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
						{renderRecursiveContent(rule.entries)}
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
						{renderRecursiveContent(skill.entries)}
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
						{renderRecursiveContent(sense.entries)}
					</div>
				</div>
			);
		}

		return null;
	};

	const handleMouseEnter = async () => {
		if (tooltipContent) return;
		setIsLoading(true);
		try {
			const content = await loadTooltipContent();
			setTooltipContent(content || null);
		} catch (error) {
			console.error("Failed to load tooltip content", error);
			setTooltipContent(null);
		} finally {
			setIsLoading(false);
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
				className={classNames("RulesLink", type && `RulesLink--${type}`)}
				onClick={handleClick}
				onMouseEnter={handleMouseEnter}
			>
				{children}
			</span>
		</Tooltip>
	);
}

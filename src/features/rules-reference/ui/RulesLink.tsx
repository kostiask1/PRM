import {
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";

import {
	getConditionByName,
	getCreatureByName,
	getDiseaseByName,
	getSenseByName,
	getSkillByName,
	getSpellByName,
	getVariantRuleByName,
	formatSourceLabel,
	getSpellMeta,
	resolveConditionInput,
	resolveDiseaseInput,
	resolveSenseInput,
	resolveSkillInput,
	resolveSpellInput,
	resolveVariantRuleInput,
} from "../../../entities/reference/index.js";
import { classNames, lang } from "../../../shared/lib/index.js";
import {
	alert,
	requestRulesReferenceNavigation,
	useAppDispatch,
} from "../../../shared/model/index.js";
import { Tooltip } from "../../../shared/ui/index.js";
import { RollDice } from "../../dice/index.js";
import {
	buildTooltipTextParts,
	loadRulesLinkPreview,
	resolveRulesLinkNavigation,
	type RulesReferencePreview,
	type RulesReferencePreviewLoaders,
	type RulesReferenceResolvers,
	type RulesReferenceType,
} from "../model/rulesLink.ts";
import "../../../assets/components/RulesLink.css";

const RULES_REFERENCE_RESOLVERS: RulesReferenceResolvers = {
	resolveSpell: resolveSpellInput,
	resolveCondition: resolveConditionInput,
	resolveDisease: resolveDiseaseInput,
	resolveVariantRule: resolveVariantRuleInput,
	resolveSkill: resolveSkillInput,
	resolveSense: resolveSenseInput,
};

const RULES_REFERENCE_LOADERS: RulesReferencePreviewLoaders = {
	getSpell: getSpellByName,
	getCreature: getCreatureByName,
	getCondition: getConditionByName,
	getDisease: getDiseaseByName,
	getVariantRule: getVariantRuleByName,
	getSkill: getSkillByName,
	getSense: getSenseByName,
};

const RULES_REFERENCE_FORMATTERS = {
	formatSource: formatSourceLabel,
	formatSpellMeta: getSpellMeta,
};

export interface RulesLinkProps {
	children?: ReactNode;
	name?: string;
	type?: RulesReferenceType;
}

interface TooltipEntryRecord extends Record<string, unknown> {
	entry?: unknown;
	type?: string;
	items?: unknown[];
	entries?: unknown[];
	name?: string;
	rows?: unknown[];
	colLabels?: unknown[];
}

function asTooltipEntryRecord(value: unknown): TooltipEntryRecord | null {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as TooltipEntryRecord)
		: null;
}

function TooltipTextContent({ value }: { value: unknown }) {
	return buildTooltipTextParts(value).map((part, index) =>
		part.kind === "roll" ? (
			<RollDice
				key={`roll-${index}`}
				formula={part.formula}
				context={part.context}
			>
				{part.label}
			</RollDice>
		) : (
			<span key={`text-${index}`}>{part.value}</span>
		),
	);
}

function TooltipList({ items }: { items: unknown[] }) {
	return (
		<ul>
			{items.map((item, index) => (
				<li key={index}>
					<TooltipEntries content={item} />
				</li>
			))}
		</ul>
	);
}

function TooltipSection({ content }: { content: TooltipEntryRecord }) {
	return (
		<div>
			{content.name && <strong>{content.name}. </strong>}
			<TooltipEntries content={content.entries} />
		</div>
	);
}

function TooltipTable({ content }: { content: TooltipEntryRecord }) {
	const rows = Array.isArray(content.rows) ? content.rows : [];
	return (
		<table>
			{Array.isArray(content.colLabels) && (
				<thead>
					<tr>
						{content.colLabels.map((label, index) => (
							<th key={index}>
								<TooltipEntries content={label} />
							</th>
						))}
					</tr>
				</thead>
			)}
			<tbody>
				{rows.map((row, rowIndex) => (
					<tr key={rowIndex}>
						{(Array.isArray(row) ? row : [row]).map((cell, cellIndex) => (
							<td key={cellIndex}>
								<TooltipEntries content={cell} />
							</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	);
}

function TooltipObject({ content }: { content: TooltipEntryRecord }) {
	if (content.entry !== undefined) {
		return <TooltipEntries content={content.entry} />;
	}
	if (content.type === "list" && Array.isArray(content.items)) {
		return <TooltipList items={content.items} />;
	}
	if (
		(content.type === "entries" || content.type === "section") &&
		Array.isArray(content.entries)
	) {
		return <TooltipSection content={content} />;
	}
	if (content.type === "table" && Array.isArray(content.rows)) {
		return <TooltipTable content={content} />;
	}
	return <TooltipTextContent value={JSON.stringify(content)} />;
}

function TooltipEntries({ content }: { content: unknown }): ReactNode {
	if (content === undefined || content === null) return null;
	if (typeof content === "string" || typeof content === "number") {
		return <TooltipTextContent value={content} />;
	}
	if (Array.isArray(content)) {
		return content.map((item, index) => (
			<span key={index}>
				<TooltipEntries content={item} />
			</span>
		));
	}
	const record = asTooltipEntryRecord(content);
	return record ? <TooltipObject content={record} /> : null;
}

function CreaturePreview({ preview }: { preview: Extract<RulesReferencePreview, { kind: "creature" }> }) {
	return (
		<div className="Tooltip__creature_card">
			<img
				className="Tooltip__creature_token"
				src={preview.imageSrc}
				alt=""
				loading="lazy"
				draggable={false}
				onError={(event) => {
					event.currentTarget.hidden = true;
				}}
			/>
			<div className="Tooltip__creature_body">
				<div className="Tooltip__title">{preview.title}</div>
				{preview.meta && <div className="Tooltip__meta">{preview.meta}</div>}
				<div className="Tooltip__creature_stats">
					{preview.ac !== "" && (
						<span>
							<strong>AC</strong> {preview.ac}
						</span>
					)}
					{preview.hp !== "" && (
						<span>
							<strong>HP</strong> {preview.hp}
						</span>
					)}
				</div>
			</div>
		</div>
	);
}

function RulesLinkPreview({ preview }: { preview: RulesReferencePreview }) {
	if (preview.kind === "creature") return <CreaturePreview preview={preview} />;
	return (
		<div className={preview.kind === "spell" ? "Tooltip__spell_card" : undefined}>
			<div className="Tooltip__title">{preview.title}</div>
			{preview.meta && <div className="Tooltip__meta">{preview.meta}</div>}
			<div className="Tooltip__text">
				<TooltipEntries content={preview.entries} />
			</div>
		</div>
	);
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error && error.message
		? error.message
		: lang.t("Unknown error");
}

export default function RulesLink({
	children,
	name,
	type = "spell",
}: RulesLinkProps) {
	const dispatch = useAppDispatch();
	const [tooltipPreview, setTooltipPreview] =
		useState<RulesReferencePreview | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const referenceName = name || String(children || "").trim();
	const referenceKey = `${type}:${referenceName}`;
	const activeTooltipLoadRef = useRef(0);

	useEffect(() => {
		activeTooltipLoadRef.current += 1;
		setTooltipPreview(null);
		setIsLoading(false);
	}, [referenceKey]);

	const showLoadError = (error: unknown) => {
		console.error("Failed to load rule reference", error);
		dispatch(
			alert({
				title: lang.t("Error"),
				message: getErrorMessage(error),
			}),
		);
	};

	const handleClick = async () => {
		try {
			const target = await resolveRulesLinkNavigation(
				type,
				referenceName,
				RULES_REFERENCE_RESOLVERS,
			);
			if (target) requestRulesReferenceNavigation(target.tab, target.name);
		} catch (error) {
			showLoadError(error);
		}
	};

	const handleMouseEnter = async () => {
		if (tooltipPreview || isLoading) return;
		const loadId = activeTooltipLoadRef.current + 1;
		activeTooltipLoadRef.current = loadId;
		setIsLoading(true);
		try {
			const preview = await loadRulesLinkPreview(
				type,
				referenceName,
				RULES_REFERENCE_LOADERS,
				RULES_REFERENCE_FORMATTERS,
			);
			if (activeTooltipLoadRef.current === loadId) {
				setTooltipPreview(preview);
			}
		} catch (error) {
			console.error("Failed to load tooltip content", error);
			if (activeTooltipLoadRef.current === loadId) {
				setTooltipPreview(null);
			}
		} finally {
			if (activeTooltipLoadRef.current === loadId) setIsLoading(false);
		}
	};

	const resolvedContent = tooltipPreview ? (
		<RulesLinkPreview preview={tooltipPreview} />
	) : isLoading ? (
		<div className="Tooltip__text">{lang.t("Loading...")}</div>
	) : null;

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

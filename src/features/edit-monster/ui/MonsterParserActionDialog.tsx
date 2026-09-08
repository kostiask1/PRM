import {
	type ComponentType,
	type ReactNode,
	useEffect,
	useMemo,
	useState,
} from "react";

import { isAbortError } from "../../../shared/api/index.ts";
import { lang } from "../../../shared/lib/index.js";
import { Button, Select, TextInput } from "../../../shared/ui/index.js";
import { parserActionsApi } from "../api/parserActionsApi.ts";
import {
	getParserActionInitialValues,
	getParserActionValidationIssue,
	normalizeParserActions,
	renderParserActionTemplate,
	renderParserReferenceAction,
	type ParserActionDefinition,
	type ParserActionContext,
	type ParserActionFieldDefinition,
	type ParserActionReferenceSelection,
	type ParserActionReferenceTab,
	type ParserActionValues,
} from "../model/parserActions.ts";
import "../../../assets/components/MonsterParserActionDialog.css";

export interface MonsterParserReferenceContentProps {
	initialTab?: ParserActionReferenceTab;
	forceTab?: boolean;
	onSelectReference: (selection: ParserActionReferenceSelection) => void;
}

interface MonsterParserActionDialogProps {
	context: ParserActionContext;
	selectedText?: string;
	onCancel: () => void;
	onInsert: (text: string) => void;
	RulesReferenceContent?:
		| ComponentType<MonsterParserReferenceContentProps>
		| null;
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error && error.message
		? error.message
		: lang.t("Could not load parser actions.");
}

function getValidationMessage(
	field: ParserActionFieldDefinition,
	reason: string,
): string {
	if (reason === "required") return lang.t("This field is required.");
	if (reason === "number") return lang.t("Enter a valid number.");
	if (reason === "min") {
		return lang.t("The value must be at least {min}.", { min: field.min ?? "" });
	}
	if (reason === "max") {
		return lang.t("The value must be at most {max}.", { max: field.max ?? "" });
	}
	return lang.t(field.validationMessage || "Enter a valid value.");
}

function ParserActionField({
	field,
	value,
	onChange,
}: {
	field: ParserActionFieldDefinition;
	value: string;
	onChange: (value: string) => void;
}) {
	const label = (
		<span className="MonsterParserActionDialog__field_label">
			{lang.t(field.label)}
			{field.required ? " *" : ""}
		</span>
	);

	if (field.control === "select") {
		return (
			<label className="MonsterParserActionDialog__field">
				{label}
				<Select
					value={value}
					onChange={(event) => onChange(String(event.target.value))}
				>
					{field.options.map((option) => (
						<option key={option.value} value={option.value}>
							{lang.t(option.label)}
						</option>
					))}
				</Select>
			</label>
		);
	}

	if (field.control === "textarea") {
		return (
			<label className="MonsterParserActionDialog__field">
				{label}
				<textarea
					className="Input Input__textarea MonsterParserActionDialog__textarea"
					rows={4}
					value={value}
					placeholder={lang.t(field.placeholder)}
					onChange={(event) => onChange(event.target.value)}
				/>
			</label>
		);
	}

	return (
		<label className="MonsterParserActionDialog__field">
			{label}
			<TextInput
				type={field.control === "number" ? "number" : "text"}
				value={value}
				placeholder={lang.t(field.placeholder)}
				min={field.min}
				max={field.max}
				onChange={(event) => onChange(event.target.value)}
			/>
		</label>
	);
}

function ParserActionHeading({
	action,
	onBack,
}: {
	action: ParserActionDefinition;
	onBack: () => void;
}) {
	return (
		<div className="MonsterParserActionDialog__step_header">
			<Button
				variant="ghost"
				size={Button.SIZES.SMALL}
				icon="back"
				onClick={onBack}
			>
				{lang.t("Back to actions")}
			</Button>
			<div>
				<h4>{lang.t(action.label)}</h4>
				<p>{lang.t(action.description)}</p>
			</div>
		</div>
	);
}

function ActionForm({
	action,
	selectedText,
	onBack,
	onInsert,
}: {
	action: ParserActionDefinition;
	selectedText: string;
	onBack: () => void;
	onInsert: (text: string) => void;
}) {
	const [values, setValues] = useState<ParserActionValues>(() =>
		getParserActionInitialValues(action, selectedText),
	);
	const [validationError, setValidationError] = useState("");
	const preview = renderParserActionTemplate(action.template, values);

	const submit = () => {
		const issue = getParserActionValidationIssue(action, values);
		if (issue) {
			setValidationError(getValidationMessage(issue.field, issue.reason));
			return;
		}
		setValidationError("");
		onInsert(preview);
	};

	return (
		<div className="MonsterParserActionDialog__step">
			<ParserActionHeading action={action} onBack={onBack} />
			<div className="MonsterParserActionDialog__form">
				{action.fields.map((field) => (
					<ParserActionField
						key={field.name}
						field={field}
						value={values[field.name] || ""}
						onChange={(value) => {
							setValues((current) => ({ ...current, [field.name]: value }));
							setValidationError("");
						}}
					/>
				))}
			</div>
			<div className="MonsterParserActionDialog__preview">
				<span>{lang.t("Template preview")}</span>
				<code>{preview}</code>
			</div>
			{validationError && (
				<div className="MonsterParserActionDialog__error" role="alert">
					{validationError}
				</div>
			)}
			<div className="MonsterParserActionDialog__footer">
				<Button variant="ghost" onClick={onBack}>
					{lang.t("Back")}
				</Button>
				<Button variant="primary" icon="plus" onClick={submit}>
					{lang.t("Insert")}
				</Button>
			</div>
		</div>
	);
}

function ReferenceAction({
	action,
	RulesReferenceContent,
	onBack,
	onInsert,
}: {
	action: ParserActionDefinition;
	RulesReferenceContent?:
		| ComponentType<MonsterParserReferenceContentProps>
		| null;
	onBack: () => void;
	onInsert: (text: string) => void;
}) {
	const [error, setError] = useState("");
	return (
		<div className="MonsterParserActionDialog__step MonsterParserActionDialog__reference_step">
			<ParserActionHeading action={action} onBack={onBack} />
			{RulesReferenceContent && action.referenceTab ? (
				<div className="MonsterParserActionDialog__reference_browser">
					<RulesReferenceContent
						key={action.type}
						initialTab={action.referenceTab}
						forceTab
						onSelectReference={(selection) => {
							const text = renderParserReferenceAction(action, selection);
							if (!text) {
								setError(lang.t("Could not create this reference."));
								return;
							}
							onInsert(text);
						}}
					/>
				</div>
			) : (
				<div className="MonsterParserActionDialog__error" role="alert">
					{lang.t("The rules browser is unavailable.")}
				</div>
			)}
			{error && (
				<div className="MonsterParserActionDialog__error" role="alert">
					{error}
				</div>
			)}
		</div>
	);
}

function ActionCatalog({
	actions,
	query,
	onQueryChange,
	onSelect,
}: {
	actions: ParserActionDefinition[];
	query: string;
	onQueryChange: (value: string) => void;
	onSelect: (action: ParserActionDefinition) => void;
}) {
	const normalizedQuery = query.trim().toLowerCase();
	const groups = useMemo(() => {
		const result = new Map<string, ParserActionDefinition[]>();
		for (const action of actions) {
			const searchableText = [action.label, action.description, action.group]
				.map((value) => lang.t(value).toLowerCase())
				.join(" ");
			if (normalizedQuery && !searchableText.includes(normalizedQuery)) continue;
			const current = result.get(action.group) || [];
			current.push(action);
			result.set(action.group, current);
		}
		return result;
	}, [actions, normalizedQuery]);

	return (
		<div className="MonsterParserActionDialog__catalog">
			<div className="MonsterParserActionDialog__intro">
				<p>
					{lang.t(
						"Choose what to insert. Actions that need more information will ask for it before changing the creature.",
					)}
				</p>
				<TextInput
					autoFocus
					value={query}
					placeholder={lang.t("Search parser actions")}
					onChange={(event) => onQueryChange(event.target.value)}
				/>
			</div>
			{groups.size ? (
				<div className="MonsterParserActionDialog__groups">
					{Array.from(groups, ([group, groupActions]) => (
						<section key={group} className="MonsterParserActionDialog__group">
							<h4>{lang.t(group)}</h4>
							<div className="MonsterParserActionDialog__action_grid">
								{groupActions.map((action) => (
									<button
										type="button"
										key={action.type}
										className="MonsterParserActionDialog__action"
										onClick={() => onSelect(action)}
									>
										<span className="MonsterParserActionDialog__action_title">
											{lang.t(action.label)}
										</span>
										<span className="MonsterParserActionDialog__action_description">
											{lang.t(action.description)}
										</span>
										<code>{action.example || action.template}</code>
									</button>
								))}
							</div>
						</section>
					))}
				</div>
			) : (
				<p className="MonsterParserActionDialog__empty">
					{lang.t("No parser actions found.")}
				</p>
			)}
		</div>
	);
}

export default function MonsterParserActionDialog({
	context,
	selectedText = "",
	onCancel,
	onInsert,
	RulesReferenceContent = null,
}: MonsterParserActionDialogProps) {
	const [actions, setActions] = useState<ParserActionDefinition[]>([]);
	const [selectedAction, setSelectedAction] =
		useState<ParserActionDefinition | null>(null);
	const [query, setQuery] = useState("");
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState("");
	const [reloadKey, setReloadKey] = useState(0);

	useEffect(() => {
		const controller = new AbortController();
		setIsLoading(true);
		setError("");
		parserActionsApi
			.list({ signal: controller.signal })
			.then((result) => {
				const normalized = normalizeParserActions(result);
				setActions(normalized);
				if (!normalized.length) {
					setError(lang.t("No parser actions are available."));
				}
			})
			.catch((loadError: unknown) => {
				if (!isAbortError(loadError)) setError(getErrorMessage(loadError));
			})
			.finally(() => {
				if (!controller.signal.aborted) setIsLoading(false);
			});
		return () => controller.abort();
	}, [reloadKey]);

	const selectAction = (action: ParserActionDefinition) => {
		if (action.interaction === "direct") {
			onInsert(renderParserActionTemplate(action.template, {}));
			return;
		}
		setSelectedAction(action);
	};

	let content: ReactNode;
	if (isLoading) {
		content = <p className="muted">{lang.t("Loading parser actions...")}</p>;
	} else if (error) {
		content = (
			<div className="MonsterParserActionDialog__load_error" role="alert">
				<p>{error}</p>
				<Button variant="ghost" onClick={() => setReloadKey((key) => key + 1)}>
					{lang.t("Try again")}
				</Button>
			</div>
		);
	} else if (!selectedAction) {
		content = (
			<ActionCatalog
				actions={actions.filter((action) => action.contexts.includes(context))}
				query={query}
				onQueryChange={setQuery}
				onSelect={selectAction}
			/>
		);
	} else if (selectedAction.interaction === "form") {
		content = (
			<ActionForm
				key={selectedAction.type}
				action={selectedAction}
				selectedText={selectedText}
				onBack={() => setSelectedAction(null)}
				onInsert={onInsert}
			/>
		);
	} else {
		content = (
			<ReferenceAction
				key={selectedAction.type}
				action={selectedAction}
				RulesReferenceContent={RulesReferenceContent}
				onBack={() => setSelectedAction(null)}
				onInsert={onInsert}
			/>
		);
	}

	return (
		<div className="MonsterParserActionDialog">
			{content}
			{!selectedAction && (
				<div className="MonsterParserActionDialog__footer">
					<Button variant="ghost" onClick={onCancel}>
						{lang.t("Back to creature editing")}
					</Button>
				</div>
			)}
		</div>
	);
}

import type { ReactNode, RefObject } from "react";
import ReactMarkdown, { type Components } from "react-markdown";

import type {
	AiResponseDetailRow,
	AiResponseHistoryEntry,
} from "../../../features/ai/ui/index.js";
import { EditableField } from "../../../features/editor/ui/index.js";
import { classNames, lang } from "../../../shared/lib/index.js";
import { Button, Modal } from "../../../shared/ui/index.js";
import { snapshotToText, type PreviewResource } from "../model/aiResponseModal.ts";
import type { AiResponseDiffViewMode } from "../model/useAiResponseDraftController.ts";

interface ResponseToolbarProps {
	hasChanges: boolean;
	isDraft: boolean;
	isCopied: boolean;
	isRestoring: boolean;
	onApply: () => void | Promise<void>;
	onCopy: () => void;
	onUndo: () => void | Promise<void>;
}

function ResponseToolbar({
	hasChanges,
	isDraft,
	isCopied,
	isRestoring,
	onApply,
	onCopy,
	onUndo,
}: ResponseToolbarProps) {
	if (!hasChanges) {
		return (
			<Button
				variant="ghost"
				size={Button.SIZES.SMALL}
				icon={isCopied ? "check" : "copy"}
				onClick={onCopy}
				title={lang.t("Copy formatted text for Word")}
			/>
		);
	}
	return (
		<>
			{!isDraft && (
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="undo"
					onClick={() => onUndo()}
					disabled={isRestoring}
					title={lang.t("Undo AI changes")}
				>
					{lang.t("Undo")}
				</Button>
			)}
			<Button
				variant="primary"
				size={Button.SIZES.SMALL}
				icon="check"
				onClick={() => onApply()}
				disabled={isRestoring}
				title={lang.t("Apply AI changes")}
			>
				{lang.t("Apply")}
			</Button>
		</>
	);
}

function ResponseDetails({ rows }: { rows: AiResponseDetailRow[] }) {
	if (rows.length === 0) return null;
	return (
		<div className="AiAssistant__response_details">
			<div className="AiAssistant__response_details_title">
				{lang.t("Request details")}
			</div>
			{rows.map((row) => (
				<div key={row.label} className="AiAssistant__response_details_row">
					<span className="AiAssistant__response_details_label">{row.label}</span>
					<span className="AiAssistant__response_details_value">{row.value}</span>
				</div>
			))}
		</div>
	);
}

interface DraftEditorProps {
	resources: PreviewResource[];
	draftEdits: Record<string, string>;
	getDiffResourceState: (resource: PreviewResource) => string;
	renderResourceActions: (resource: PreviewResource) => ReactNode;
	updateDraftText: (resource: PreviewResource, text: string) => void;
}

function DraftResourceEditor({
	resource,
	text,
	getDiffResourceState,
	renderResourceActions,
	updateDraftText,
}: Omit<DraftEditorProps, "resources" | "draftEdits"> & {
	resource: PreviewResource;
	text: string;
}) {
	const isNew = resource.before === null;
	return (
		<div
			className={classNames("AiAssistant__draft_resource", isNew && "is_new")}
		>
			<div className="AiAssistant__draft_resource_header">
				<span>{resource.label}</span>
				<div className="AiAssistant__preview_resource_actions">
					<span>{getDiffResourceState(resource)}</span>
					{renderResourceActions(resource)}
				</div>
			</div>
			<div className="AiAssistant__draft_columns">
				{!isNew && (
					<div className="AiAssistant__draft_column">
						<div className="AiAssistant__draft_column_title">{lang.t("Before")}</div>
						<pre>{snapshotToText(resource.before)}</pre>
					</div>
				)}
				<div className="AiAssistant__draft_column">
					<div className="AiAssistant__draft_column_title">
						{isNew ? lang.t("New") : lang.t("After")}
					</div>
					<EditableField
						type="textarea"
						className="AiAssistant__draft_textarea"
						value={text}
						onChange={(event) => updateDraftText(resource, event.target.value)}
					/>
				</div>
			</div>
		</div>
	);
}

function DraftEditor(props: DraftEditorProps) {
	return (
		<div className="AiAssistant__draft_editor">
			<div className="AiAssistant__draft_editor_title">
				{lang.t("Draft values before applying")}
			</div>
			{props.resources.map((resource) => (
				<DraftResourceEditor
					key={resource.id}
					resource={resource}
					text={props.draftEdits[resource.id] || ""}
					getDiffResourceState={props.getDiffResourceState}
					renderResourceActions={props.renderResourceActions}
					updateDraftText={props.updateDraftText}
				/>
			))}
		</div>
	);
}

interface ResponseDiffProps extends DraftEditorProps {
	entry: AiResponseHistoryEntry | null;
	isDraft: boolean;
	viewMode: AiResponseDiffViewMode;
	draftError: string;
	preview: ReactNode;
	jsonDiff: ReactNode;
	getHistoryChangeSummary: (entry: AiResponseHistoryEntry | null) => string;
	setViewMode: (mode: AiResponseDiffViewMode) => void;
}

function DiffViewSwitch({
	viewMode,
	setViewMode,
}: Pick<ResponseDiffProps, "viewMode" | "setViewMode">) {
	return (
		<div className="AiAssistant__diff_view_switch">
			<Button
				variant={viewMode === "preview" ? "primary" : "ghost"}
				size={Button.SIZES.SMALL}
				onClick={() => setViewMode("preview")}
			>
				{lang.t("Preview")}
			</Button>
			<Button
				variant={viewMode === "json" ? "primary" : "ghost"}
				size={Button.SIZES.SMALL}
				onClick={() => setViewMode("json")}
			>
				JSON
			</Button>
		</div>
	);
}

function ResponseDiff(props: ResponseDiffProps) {
	const hasDraftResources = props.isDraft && props.resources.length > 0;
	return (
		<div className="AiAssistant__diff">
			<div className="AiAssistant__diff_title">
				<span>{lang.t("Changes")}</span>
				<span>{props.getHistoryChangeSummary(props.entry)}</span>
			</div>
			{props.isDraft && (
				<div className="AiAssistant__diff_hint">
					{lang.t(
						"You can enable automatic applying of parsed AI changes in settings.",
					)}
				</div>
			)}
			<DiffViewSwitch viewMode={props.viewMode} setViewMode={props.setViewMode} />
			{props.viewMode === "preview" ? props.preview : props.jsonDiff}
			{hasDraftResources && props.draftError && (
				<div className="AiAssistant__draft_error">{props.draftError}</div>
			)}
			{hasDraftResources && props.viewMode === "json" && <DraftEditor {...props} />}
		</div>
	);
}

export interface AiResponseModalViewProps extends DraftEditorProps {
	generatedPrompt: string;
	generatedPromptRef: RefObject<HTMLDivElement | null>;
	isGeneratedPromptCopied: boolean;
	isRestoringResponse: boolean;
	markdownComponents: Components;
	onApply: () => void | Promise<void>;
	onCancel: () => void;
	onCopy: () => void;
	onUndo: () => void | Promise<void>;
	selectedResponseDetails: AiResponseDetailRow[];
	selectedResponseEntry: AiResponseHistoryEntry | null;
	selectedResponseHasChanges: boolean;
	isDraft: boolean;
	viewMode: AiResponseDiffViewMode;
	setViewMode: (mode: AiResponseDiffViewMode) => void;
	draftError: string;
	preview: ReactNode;
	jsonDiff: ReactNode;
	getHistoryChangeSummary: (entry: AiResponseHistoryEntry | null) => string;
}

export default function AiResponseModalView(props: AiResponseModalViewProps) {
	return (
		<Modal
			title={lang.t("Response")}
			onConfirm={() => {}}
			onCancel={props.onCancel}
			showFooter={false}
			overlayClassName={classNames(
				"AiAssistant__response_overlay",
				props.selectedResponseHasChanges && "AiAssistant__response_overlay_wide",
			)}
			cancelDisabled={props.isRestoringResponse}
		>
			<div className="AiAssistant__prompt_result_wrap">
				<div className="AiAssistant__prompt_result_actions">
					<ResponseToolbar
						hasChanges={props.selectedResponseHasChanges}
						isDraft={props.isDraft}
						isCopied={props.isGeneratedPromptCopied}
						isRestoring={props.isRestoringResponse}
						onApply={props.onApply}
						onCopy={props.onCopy}
						onUndo={props.onUndo}
					/>
				</div>
				{!props.selectedResponseHasChanges && (
					<div
						className="AiAssistant__prompt_result"
						ref={props.generatedPromptRef as RefObject<HTMLDivElement>}
					>
						<ReactMarkdown components={props.markdownComponents}>
							{props.generatedPrompt}
						</ReactMarkdown>
					</div>
				)}
				<ResponseDetails rows={props.selectedResponseDetails} />
				{props.selectedResponseHasChanges && (
					<ResponseDiff
						{...props}
						entry={props.selectedResponseEntry}
					/>
				)}
			</div>
		</Modal>
	);
}

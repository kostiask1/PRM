import ReactMarkdown from "react-markdown";

import Button from "../form/Button";
import Modal from "../common/Modal";
import classNames from "../../utils/classNames";
import { lang } from "../../services/localization";

export default function AiResponseModal({
	generatedPrompt,
	generatedPromptRef,
	isGeneratedPromptCopied,
	isRestoringResponse,
	markdownComponents,
	onApply,
	onCancel,
	onCopy,
	onUndo,
	selectedResponseDetails,
	selectedResponseDiffResources,
	selectedResponseEntry,
	selectedResponseHasChanges,
	getDiffResourceState,
	getHistoryChangeSummary,
}) {
	if (!generatedPrompt) return null;

	return (
		<Modal
			title={lang.t("Response")}
			onCancel={onCancel}
			showFooter={false}
			overlayClassName="AiAssistant__response_overlay"
		>
			<div className="AiAssistant__prompt_result_wrap">
				<div className="AiAssistant__prompt_result_actions">
					{selectedResponseHasChanges && (
						<>
							<Button
								variant="ghost"
								size={Button.SIZES.SMALL}
								icon="undo"
								onClick={onUndo}
								disabled={isRestoringResponse}
								title={lang.t("Undo AI changes")}
							>
								{lang.t("Undo")}
							</Button>
							<Button
								variant="primary"
								size={Button.SIZES.SMALL}
								icon="check"
								onClick={onApply}
								disabled={isRestoringResponse}
								title={lang.t("Apply AI changes")}
							>
								{lang.t("Apply")}
							</Button>
						</>
					)}
					{!selectedResponseHasChanges && (
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							icon={isGeneratedPromptCopied ? "check" : "copy"}
							onClick={onCopy}
							title={lang.t("Copy formatted text for Word")}
						/>
					)}
				</div>
				{!selectedResponseHasChanges && (
					<div className="AiAssistant__prompt_result" ref={generatedPromptRef}>
						<ReactMarkdown components={markdownComponents}>
							{generatedPrompt}
						</ReactMarkdown>
					</div>
				)}
				{selectedResponseDetails.length > 0 && (
					<div className="AiAssistant__response_details">
						<div className="AiAssistant__response_details_title">
							{lang.t("Request details")}
						</div>
						{selectedResponseDetails.map((row) => (
							<div
								key={row.label}
								className="AiAssistant__response_details_row"
							>
								<span className="AiAssistant__response_details_label">
									{row.label}
								</span>
								<span className="AiAssistant__response_details_value">
									{row.value}
								</span>
							</div>
						))}
					</div>
				)}
				{selectedResponseHasChanges && (
					<div className="AiAssistant__diff">
						<div className="AiAssistant__diff_title">
							<span>{lang.t("Changes")}</span>
							<span>{getHistoryChangeSummary(selectedResponseEntry)}</span>
						</div>
						{selectedResponseDiffResources.map((resource) => (
							<div key={resource.id} className="AiAssistant__diff_file">
								<div className="AiAssistant__diff_file_header">
									<span>{resource.label}</span>
									<span>{getDiffResourceState(resource)}</span>
								</div>
								{resource.fieldSummary.length > 0 && (
									<div className="AiAssistant__diff_field_summary">
										<span>{lang.t("Changed fields")}:</span>
										{resource.fieldSummary.map((field) => (
											<code key={`${resource.id}-${field}`}>{field}</code>
										))}
									</div>
								)}
								<div className="AiAssistant__diff_lines">
									{resource.lines.map((line, index) => (
										<div
											key={`${resource.id}-${index}`}
											className={classNames(
												"AiAssistant__diff_line",
												`is_${line.type}`,
											)}
										>
											<span className="AiAssistant__diff_line_number">
												{line.oldNumber || ""}
											</span>
											<span className="AiAssistant__diff_line_number">
												{line.newNumber || ""}
											</span>
											<span className="AiAssistant__diff_line_marker">
												{line.type === "added"
													? "+"
													: line.type === "removed"
														? "-"
														: " "}
											</span>
											<code>{line.text || " "}</code>
										</div>
									))}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</Modal>
	);
}

import ReactList from "react-list";

import { lang } from "../../../shared/lib/index.js";
import { Button, ListCard } from "../../../shared/ui/index.js";
import { hasAiResponseHistory } from "./presentationModel.ts";
import type { AiResponseHistoryEntry } from "./responseModalContracts.ts";

export interface AiResponseHistoryProps {
	entries?: AiResponseHistoryEntry[] | null;
	currentLanguage?: string;
	storageSizeLabel?: string;
	onClear: () => void;
	onDelete: (entry: AiResponseHistoryEntry) => void;
	onRetry: (entry: AiResponseHistoryEntry) => void;
	onSelect: (entry: AiResponseHistoryEntry) => void;
	canRetry?: (entry: AiResponseHistoryEntry) => boolean;
	formatResponseDate: (createdAt?: string, language?: string) => string;
	getTitle: (entry: AiResponseHistoryEntry) => string;
	getSummary: (entry: AiResponseHistoryEntry) => string;
	getStateLabel: (entry: AiResponseHistoryEntry) => string;
}

export default function AiResponseHistory({
	entries,
	currentLanguage,
	storageSizeLabel,
	onClear,
	onDelete,
	onRetry,
	onSelect,
	canRetry,
	formatResponseDate,
	getTitle,
	getSummary,
	getStateLabel,
}: AiResponseHistoryProps) {
	if (!hasAiResponseHistory(entries)) return null;

	const renderHistoryEntry = (index: number, key: number | string) => {
		const entry = entries[index];
		if (!entry) return null;
		const responsePreview = getTitle(entry);
		const changeSummary = getSummary(entry);
		const stateLabel = getStateLabel(entry);
		return (
			<ListCard
				key={key}
				onClick={() => onSelect(entry)}
				className="AiAssistant__history_card"
				actions={
					<>
						{canRetry?.(entry) && (
							<Button
								variant="ghost"
								size={Button.SIZES.SMALL}
								icon="retry"
								onClick={() => onRetry(entry)}
								title={lang.t("Retry request")}
							/>
						)}
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							icon="trash"
							onClick={() => onDelete(entry)}
							title={lang.t("Delete response")}
						/>
					</>
				}
			>
				<div className="ListCard__title AiAssistant__history_title">
					{responsePreview || lang.t("AI response")}
				</div>
				<div className="ListCard__meta AiAssistant__history_meta">
					<span>{formatResponseDate(entry.createdAt, currentLanguage)}</span>
					{changeSummary && <span>{changeSummary}</span>}
					{stateLabel && <span>{stateLabel}</span>}
				</div>
			</ListCard>
		);
	};

	return (
		<section className="AiAssistant__response_history">
			<div className="AiAssistant__response_history_header">
				<div className="AiAssistant__response_history_title">
					<h4>{lang.t("Response history")}</h4>
					{storageSizeLabel && (
						<span>
							{lang.t("AI request history size")}: {storageSizeLabel}
						</span>
					)}
				</div>
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="trash"
					onClick={onClear}
					title={lang.t("Clear response history")}
				>
					{lang.t("Clear")}
				</Button>
			</div>
			<div className="AiAssistant__response_history_list">
				<ReactList
					itemRenderer={renderHistoryEntry}
					length={entries.length}
					type="variable"
				/>
			</div>
		</section>
	);
}

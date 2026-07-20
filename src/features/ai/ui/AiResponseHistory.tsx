import ReactList from "react-list";

import { lang } from "../../../shared/lib/index.js";
import { Button, ListCard } from "../../../shared/ui/index.js";
import {
	getAiResponseHistoryRowView,
	hasAiResponseHistory,
} from "./presentationModel.ts";
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

interface AiResponseHistoryRowProps
	extends Pick<
		AiResponseHistoryProps,
		| "canRetry"
		| "currentLanguage"
		| "formatResponseDate"
		| "getStateLabel"
		| "getSummary"
		| "getTitle"
		| "onDelete"
		| "onRetry"
		| "onSelect"
	> {
	entry: AiResponseHistoryEntry;
}

function AiResponseHistoryRow({
	canRetry,
	currentLanguage,
	entry,
	formatResponseDate,
	getStateLabel,
	getSummary,
	getTitle,
	onDelete,
	onRetry,
	onSelect,
}: AiResponseHistoryRowProps) {
	const view = getAiResponseHistoryRowView({
		canRetry,
		currentLanguage,
		entry,
		fallbackTitle: lang.t("AI response"),
		formatResponseDate,
		getStateLabel,
		getSummary,
		getTitle,
	});
	return (
		<ListCard
			onClick={() => onSelect(entry)}
			className="AiAssistant__history_card"
			actions={
				<>
					{view.showRetry && (
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
				{view.title}
			</div>
			<div className="ListCard__meta AiAssistant__history_meta">
				<span>{view.dateLabel}</span>
				{view.changeSummary && <span>{view.changeSummary}</span>}
				{view.stateLabel && <span>{view.stateLabel}</span>}
			</div>
		</ListCard>
	);
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
		return (
			<AiResponseHistoryRow
				key={key}
				canRetry={canRetry}
				currentLanguage={currentLanguage}
				entry={entry}
				formatResponseDate={formatResponseDate}
				getStateLabel={getStateLabel}
				getSummary={getSummary}
				getTitle={getTitle}
				onDelete={onDelete}
				onRetry={onRetry}
				onSelect={onSelect}
			/>
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

import Button from "../form/Button";
import ListCard from "../common/ListCard";
import { lang } from "../../services/localization";

export default function AiResponseHistory({
	entries,
	currentLanguage,
	onClear,
	onDelete,
	onRetry,
	onSelect,
	canRetry,
	formatResponseDate,
	getTitle,
	getSummary,
	getStateLabel,
}) {
	if (!Array.isArray(entries) || entries.length === 0) return null;

	return (
		<section className="AiAssistant__response_history">
			<div className="AiAssistant__response_history_header">
				<h4>{lang.t("Response history")}</h4>
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
				{entries.map((entry) => {
					const responsePreview = getTitle(entry);
					const changeSummary = getSummary(entry);
					const stateLabel = getStateLabel(entry);
					return (
						<ListCard
							key={entry.id}
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
				})}
			</div>
		</section>
	);
}

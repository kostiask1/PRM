import type { ReactNode } from "react";

interface AiResponseEncounterMonsterChangeProps {
	afterCard?: ReactNode;
	afterLabel?: ReactNode;
	beforeCard?: ReactNode;
	beforeLabel?: ReactNode;
	isPaired: boolean;
	label: ReactNode;
	singleCard?: ReactNode;
	statusLabel?: ReactNode;
}

export default function AiResponseEncounterMonsterChange({
	afterCard,
	afterLabel,
	beforeCard,
	beforeLabel,
	isPaired,
	label,
	singleCard,
	statusLabel,
}: AiResponseEncounterMonsterChangeProps) {
	return isPaired ? (
		<div className="AiAssistant__preview_card_columns">
			<div className="AiAssistant__preview_card_frame">
				<div className="AiAssistant__preview_column_title">
					{label} / {beforeLabel}
				</div>
				{beforeCard}
			</div>
			<div className="AiAssistant__preview_card_frame">
				<div className="AiAssistant__preview_column_title">
					{label} / {afterLabel}
				</div>
				{afterCard}
			</div>
		</div>
	) : (
		<div className="AiAssistant__preview_card_stack">
			<div className="AiAssistant__preview_card_frame">
				<div className="AiAssistant__preview_column_title">
					{label} / {statusLabel}
				</div>
				{singleCard}
			</div>
		</div>
	);
}

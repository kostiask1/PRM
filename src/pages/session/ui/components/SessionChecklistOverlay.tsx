import type { SessionChecklistItem } from "../../model/contracts.ts";
import { lang } from "../../../../shared/lib/index.js";
import "../../../../assets/components/SessionChecklistOverlay.css";
import { Modal } from "../../../../shared/ui/index.js";
import TodoItem from "./TodoItem.tsx";

interface SessionChecklistOverlayProps {
	checklistItems: SessionChecklistItem[];
	onClose: () => void;
	onChecklistItemChange: (itemId: string, checked: boolean) => void;
	progress: number;
	sessionData: Record<string, unknown>;
}

export default function SessionChecklistOverlay({
	checklistItems,
	onClose,
	onChecklistItemChange,
	progress,
	sessionData,
}: SessionChecklistOverlayProps) {
	return (
		<Modal
			title={lang.t("Preparation checklist")}
			onConfirm={onClose}
			onCancel={onClose}
			showFooter={false}
		>
			<div className="SessionChecklistOverlay__modal">
				<div className="SessionChecklistOverlay__progressWrap">
					<div className="SessionChecklistOverlay__progressLabel">
						<span>{lang.t("Preparation progress")}</span>
						<span>{progress}%</span>
					</div>
					<div className="SessionChecklistOverlay__progress">
						<div
							className="SessionChecklistOverlay__progressFill"
							style={{ width: `${progress}%` }}
						/>
					</div>
				</div>
				{checklistItems.map((item) => (
					<TodoItem
						key={item.id}
						checked={Boolean(sessionData[`${item.id}_check`])}
						onChange={(checked) => onChecklistItemChange(item.id, checked)}
						title={item.label}
						note={item.note}
					/>
				))}
			</div>
		</Modal>
	);
}

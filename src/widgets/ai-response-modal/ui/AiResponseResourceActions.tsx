import { Button } from "../../../shared/ui/index.js";
import { lang } from "../../../shared/lib/index.js";
import {
	isResourceApplied,
	isResourceUndone,
	type PreviewResource,
} from "../model/aiResponseModal.ts";

interface ActionButtonProps {
	resource: PreviewResource;
	disabled: boolean;
	visible: boolean;
	onAction: (resource: PreviewResource) => void | Promise<void>;
}

function AppliedState({ visible }: { visible: boolean }) {
	return visible ? (
		<span className="AiAssistantPanel__preview_resource_state is_applied">
			{lang.t("Applied")}
		</span>
	) : null;
}

function UndoneState({ visible }: { visible: boolean }) {
	return visible ? (
		<span className="AiAssistantPanel__preview_resource_state is_undone">
			{lang.t("Undone")}
		</span>
	) : null;
}

function ApplyButton({ resource, disabled, visible, onAction }: ActionButtonProps) {
	return visible ? (
		<Button
			variant="ghost"
			size={Button.SIZES.SMALL}
			icon="check"
			onClick={() => onAction(resource)}
			disabled={disabled}
			title={lang.t("Apply selected AI change")}
		>
			{lang.t("Apply")}
		</Button>
	) : null;
}

function UndoButton({ resource, disabled, visible, onAction }: ActionButtonProps) {
	return visible ? (
		<Button
			variant="ghost"
			size={Button.SIZES.SMALL}
			icon="undo"
			onClick={() => onAction(resource)}
			disabled={disabled}
			title={lang.t("Undo selected AI change")}
		>
			{lang.t("Undo")}
		</Button>
	) : null;
}

interface AiResponseResourceActionsProps {
	resource: PreviewResource;
	isDraft: boolean;
	isRestoringResponse: boolean;
	onApply: (resource: PreviewResource) => void | Promise<void>;
	onUndo: (resource: PreviewResource) => void | Promise<void>;
}

export default function AiResponseResourceActions({
	resource,
	isDraft,
	isRestoringResponse,
	onApply,
	onUndo,
}: AiResponseResourceActionsProps) {
	const applied = isResourceApplied(resource);
	const undone = isResourceUndone(resource);
	return (
		<>
			<AppliedState visible={applied} />
			<UndoneState visible={undone} />
			<ApplyButton
				resource={resource}
				disabled={isRestoringResponse}
				visible={isDraft && !applied}
				onAction={onApply}
			/>
			<UndoButton
				resource={resource}
				disabled={isRestoringResponse}
				visible={applied || (isDraft && !undone)}
				onAction={onUndo}
			/>
		</>
	);
}

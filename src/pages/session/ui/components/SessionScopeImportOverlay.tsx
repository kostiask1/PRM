import { Button, Modal } from "../../../../shared/ui/index.js";
import { lang } from "../../../../shared/lib/index.js";
import { renderMentionText } from "../../../../features/entity-link/index.js";
import type { ScopeImportModalState } from "../../../../features/campaign-entity/index.js";
import type { SessionScopeImportCopy } from "../../model/sessionPagePresentation.ts";
import {
	getSessionEntityDisplayName,
	type SessionEntityType,
} from "../../model/sessionEntityModel.ts";

type SessionScopeImportItem = ScopeImportModalState["items"][number];

interface SessionScopeImportOverlayProps {
	modal: ScopeImportModalState | null;
	copy: SessionScopeImportCopy | null;
	type: SessionEntityType;
	onClose: () => void;
	onMoveToSession: (
		type: SessionEntityType,
		entity: SessionScopeImportItem,
	) => void;
}

interface SessionScopeImportItemProps {
	type: SessionEntityType;
	entity: SessionScopeImportItem;
	onMoveToSession: SessionScopeImportOverlayProps["onMoveToSession"];
}

function SessionScopeImportItem({
	type,
	entity,
	onMoveToSession,
}: SessionScopeImportItemProps) {
	const name = getSessionEntityDisplayName(type, entity, lang.t("Untitled"));
	return (
		<div className="SessionView__scopeImportItem">
			<span>{renderMentionText(name)}</span>
			<Button
				variant="primary"
				size={Button.SIZES.SMALL}
				icon="import"
				onClick={() => onMoveToSession(type, entity)}
			>
				{lang.t("Move to session")}
			</Button>
		</div>
	);
}

function getSessionScopeImportItemKey(
	entity: SessionScopeImportItem,
	type: SessionEntityType,
): string {
	return String(
		entity.slug ||
		entity.id ||
		getSessionEntityDisplayName(type, entity, lang.t("Untitled")),
	);
}

interface SessionScopeImportListProps {
	modal: ScopeImportModalState;
	copy: SessionScopeImportCopy;
	type: SessionEntityType;
	onMoveToSession: SessionScopeImportOverlayProps["onMoveToSession"];
}

function SessionScopeImportList({
	modal,
	copy,
	type,
	onMoveToSession,
}: SessionScopeImportListProps) {
	if (modal.isLoading) return <div className="muted">{lang.t("Loading...")}</div>;
	if (modal.items.length === 0) return <div className="muted">{copy.emptyText}</div>;
	return modal.items.map((entity) => (
		<SessionScopeImportItem
			key={getSessionScopeImportItemKey(entity, type)}
			type={type}
			entity={entity}
			onMoveToSession={onMoveToSession}
		/>
	));
}

export default function SessionScopeImportOverlay({
	modal,
	copy,
	type,
	onClose,
	onMoveToSession,
}: SessionScopeImportOverlayProps) {
	if (!modal || !copy) return null;
	return (
		<Modal
			title={copy.title}
			onConfirm={onClose}
			onCancel={onClose}
			showFooter={false}
		>
			<div className="SessionView__scopeImportList">
				<SessionScopeImportList
					modal={modal}
					copy={copy}
					type={type}
					onMoveToSession={onMoveToSession}
				/>
			</div>
		</Modal>
	);
}

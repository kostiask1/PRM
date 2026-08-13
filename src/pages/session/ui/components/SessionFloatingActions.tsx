import { GlobalSearchModal } from "../../../../widgets/campaign-search/index.js";
import { lang } from "../../../../shared/lib/index.js";
import { Icon, Tooltip } from "../../../../shared/ui/index.js";

interface SessionFloatingActionsProps {
	progress: number;
	isGlobalSearchOpen: boolean;
	onOpenChecklist: () => void;
	onCloseGlobalSearch: () => void;
}

export default function SessionFloatingActions({
	progress,
	isGlobalSearchOpen,
	onOpenChecklist,
	onCloseGlobalSearch,
}: SessionFloatingActionsProps) {
	return (
		<>
			<Tooltip
				content={lang.t("Preparation checklist")}
				className="SessionView__checklistToggle"
			>
				<button onClick={onOpenChecklist}>
					<Icon name="list" size={28} />
					{progress < 100 && <span className="SessionView__checklistBadge" />}
				</button>
			</Tooltip>
			{isGlobalSearchOpen && (
				<GlobalSearchModal onCancel={onCloseGlobalSearch} />
			)}
		</>
	);
}

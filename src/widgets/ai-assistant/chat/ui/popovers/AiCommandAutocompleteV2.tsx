import { useEffect, useRef } from "react";
import type { RankedAiCommandItem } from "../../model/aiCommandAutocomplete.ts";
import { useDismissablePopover } from "./useDismissablePopover.ts";

interface AiCommandAutocompleteV2Props {
	isOpen: boolean;
	items: readonly RankedAiCommandItem[];
	activeIndex: number;
	onHoverIndex: (index: number) => void;
	onSelect: (command: string) => void;
	onClose: () => void;
}

export default function AiCommandAutocompleteV2({
	isOpen,
	items,
	activeIndex,
	onHoverIndex,
	onSelect,
	onClose,
}: AiCommandAutocompleteV2Props) {
	const ref = useRef<HTMLDivElement>(null);
	const activeItemRef = useRef<HTMLButtonElement>(null);

	useDismissablePopover({
		isOpen: isOpen && items.length > 0,
		popoverRef: ref,
		triggerSelector: ".AiChatComposerV2__editor",
		onClose,
	});

	useEffect(() => {
		if (!isOpen || items.length === 0) return;
		activeItemRef.current?.scrollIntoView({ block: "nearest" });
	}, [isOpen, activeIndex, items.length]);

	if (!isOpen || items.length === 0) return null;

	const safeIndex = Math.max(0, Math.min(activeIndex, items.length - 1));
	const activeEntry = items[safeIndex];
	const activeShortcutHint =
		activeEntry?.item.command === "@bestiary"
			? "Ctrl+K — істоти Бестіарію"
			: "Ctrl+K — сутності кампанії";

	return (
		<div
			className="AiCommandAutocompleteV2"
			ref={ref}
			role="listbox"
			aria-label="Швидкі команди асистента"
		>
			<div className="AiCommandAutocompleteV2__header">
				<span className="AiCommandAutocompleteV2__title">Команди</span>
				<span className="AiCommandAutocompleteV2__kbdHint">↑↓ · Tab/Enter · Esc</span>
			</div>

			<div className="AiCommandAutocompleteV2__list">
				{items.map((entry, idx) => {
					const isActive = idx === safeIndex;
					return (
						<button
							key={entry.item.command}
							ref={isActive ? activeItemRef : undefined}
							type="button"
							role="option"
							aria-selected={isActive}
							className={`AiCommandAutocompleteV2__item ${isActive ? "is-active" : ""} ${entry.isAlreadyUsed ? "is-used" : ""}`}
							onMouseDown={(e) => e.preventDefault()}
							onMouseEnter={() => onHoverIndex(idx)}
							onClick={() => onSelect(entry.item.command)}
						>
							<div className="AiCommandAutocompleteV2__itemTop">
								<span className="AiCommandAutocompleteV2__badge">{entry.item.command}</span>
								<span className="AiCommandAutocompleteV2__name">{entry.item.name}</span>
								{entry.isContextual && !entry.isAlreadyUsed && (
									<span className="AiCommandAutocompleteV2__tag AiCommandAutocompleteV2__tag--context">
										Контекст
									</span>
								)}
								{entry.isAlreadyUsed && (
									<span className="AiCommandAutocompleteV2__tag AiCommandAutocompleteV2__tag--used">
										Додано
									</span>
								)}
							</div>
							<div className="AiCommandAutocompleteV2__desc">{entry.item.description}</div>
						</button>
					);
				})}
			</div>

			{activeEntry && (
				<div className="AiCommandAutocompleteV2__footer">
					<span className="AiCommandAutocompleteV2__example" title={activeEntry.item.example}>
						Приклад: {activeEntry.item.example}
					</span>
					<span className="AiCommandAutocompleteV2__shortcutHint">{activeShortcutHint}</span>
				</div>
			)}
		</div>
	);
}

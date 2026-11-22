import { useRef } from "react";
import { AI_COMMANDS } from "../../model/aiCommands.ts";
import type { AiCommandItem } from "../../model/aiChatTypes.ts";
import { useDismissablePopover } from "./useDismissablePopover.ts";

interface AiCommandsInfoTooltipV2Props {
	isOpen: boolean;
	onClose: () => void;
	onSelectCommand: (command: string) => void;
}

export default function AiCommandsInfoTooltipV2({
	isOpen,
	onClose,
	onSelectCommand,
}: AiCommandsInfoTooltipV2Props) {
	const ref = useRef<HTMLDivElement>(null);

	useDismissablePopover({
		isOpen,
		popoverRef: ref,
		triggerSelector: ".AiChatComposerV2__infoBtn",
		onClose,
	});

	if (!isOpen) return null;

	return (
		<div className="AiCommandsInfoTooltipV2" ref={ref}>
			<div className="AiCommandsInfoTooltipV2__header">
				<div className="AiCommandsInfoTooltipV2__title">
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<circle cx="12" cy="12" r="10" />
						<line x1="12" y1="16" x2="12" y2="12" />
						<line x1="12" y1="8" x2="12.01" y2="8" />
					</svg>
					<span>Швидкі команди асистента</span>
				</div>
				<button
					type="button"
					className="AiCommandsInfoTooltipV2__closeBtn"
					onClick={onClose}
					aria-label="Закрити підказку"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			<div className="AiCommandsInfoTooltipV2__body">
				<p className="AiCommandsInfoTooltipV2__intro">
					Введіть символ <code>@</code> у полі введення або натисніть команду для швидкого старту:
				</p>

				<div className="AiCommandsInfoTooltipV2__list">
					{AI_COMMANDS.map((item: AiCommandItem) => (
						<button
							key={item.command}
							type="button"
							className="AiCommandsInfoTooltipV2__item"
							onClick={() => onSelectCommand(item.command)}
							title={`Приклад: ${item.example}`}
						>
							<div className="AiCommandsInfoTooltipV2__itemHeader">
								<span className="AiCommandsInfoTooltipV2__badge">{item.command}</span>
								<span className="AiCommandsInfoTooltipV2__name">{item.name}</span>
							</div>
							<div className="AiCommandsInfoTooltipV2__desc">{item.description}</div>
						</button>
					))}
				</div>

				<div className="AiCommandsInfoTooltipV2__footer">
					<span className="AiCommandsInfoTooltipV2__tipIcon">💡</span>
					<span>
						Використовуйте <code>[Назва]</code> або комбінацію <code>Ctrl+K</code> для швидкої вставки сутностей кампанії (та істот Бестіарію з <code>@bestiary</code>).
					</span>
				</div>
			</div>
		</div>
	);
}

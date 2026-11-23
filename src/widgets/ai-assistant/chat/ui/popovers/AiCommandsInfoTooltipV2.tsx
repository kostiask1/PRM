import { Fragment, useRef } from "react";
import { lang } from "../../../../../shared/lib/index.js";
import { AI_COMMANDS } from "../../model/aiCommands.ts";
import type { AiCommandItem } from "../../model/aiChatTypes.ts";
import { useDismissablePopover } from "./useDismissablePopover.ts";

interface AiCommandsInfoTooltipV2Props {
	isOpen: boolean;
	onClose: () => void;
	onSelectCommand: (command: string) => void;
}

function renderInlineCode(text: string) {
	const parts = text.split(/(`[^`]+`)/g);
	return parts.map((part, idx) =>
		part.startsWith("`") && part.endsWith("`") ? (
			<code key={idx}>{part.slice(1, -1)}</code>
		) : (
			<Fragment key={idx}>{part}</Fragment>
		),
	);
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
					<span>{lang.t("Assistant quick commands")}</span>
				</div>
				<button
					type="button"
					className="AiCommandsInfoTooltipV2__closeBtn"
					onClick={onClose}
					aria-label={lang.t("Close hint")}
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			<div className="AiCommandsInfoTooltipV2__body">
				<p className="AiCommandsInfoTooltipV2__intro">
					{renderInlineCode(
						lang.t("Type `@` in the input field or click a command to get started:"),
					)}
				</p>

				<div className="AiCommandsInfoTooltipV2__list">
					{AI_COMMANDS.map((item: AiCommandItem) => (
						<button
							key={item.command}
							type="button"
							className="AiCommandsInfoTooltipV2__item"
							onClick={() => onSelectCommand(item.command)}
							title={lang.t("Example: {example}", { example: lang.t(item.example) })}
						>
							<div className="AiCommandsInfoTooltipV2__itemHeader">
								<span className="AiCommandsInfoTooltipV2__badge">{item.command}</span>
								<span className="AiCommandsInfoTooltipV2__name">{lang.t(item.name)}</span>
							</div>
							<div className="AiCommandsInfoTooltipV2__desc">{lang.t(item.description)}</div>
						</button>
					))}
				</div>

				<div className="AiCommandsInfoTooltipV2__footer">
					<span className="AiCommandsInfoTooltipV2__tipIcon">💡</span>
					<span>
						{renderInlineCode(
							lang.t(
								"Use `[Name]` or `Ctrl+K` to quickly insert campaign entities (and Bestiary creatures with `@bestiary`).",
							),
						)}
					</span>
				</div>
			</div>
		</div>
	);
}

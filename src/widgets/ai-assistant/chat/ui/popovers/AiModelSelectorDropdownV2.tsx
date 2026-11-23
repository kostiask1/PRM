import { useEffect, useMemo, useRef, useState } from "react";
import { lang } from "../../../../../shared/lib/index.js";
import {
	formatCompactContextWindow,
	localizeAiModelOption,
} from "../../model/aiChatLocalization.ts";
import { AI_MODELS } from "../../model/aiModels.ts";
import type { AiModelOption } from "../../model/aiChatTypes.ts";
import { useDismissablePopover } from "./useDismissablePopover.ts";

interface AiModelSelectorDropdownV2Props {
	isOpen: boolean;
	onClose: () => void;
	models?: readonly AiModelOption[];
	selectedModel: string;
	onSelectModel: (modelId: string) => void;
}

function shouldShowModelDescription(model: AiModelOption): boolean {
	const desc = model.description?.trim() || "";
	if (!desc) return false;
	return desc.toLowerCase() !== model.name.trim().toLowerCase();
}

export default function AiModelSelectorDropdownV2({
	isOpen,
	onClose,
	models = [],
	selectedModel,
	onSelectModel,
}: AiModelSelectorDropdownV2Props) {
	const ref = useRef<HTMLDivElement>(null);
	const selectedItemRef = useRef<HTMLButtonElement>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const currentLanguage = lang.getLanguage();

	useDismissablePopover({
		isOpen,
		popoverRef: ref,
		triggerSelector: ".AiChatComposerV2__modelPill",
		onClose,
	});

	useEffect(() => {
		if (!isOpen) {
			setSearchQuery("");
			return;
		}
		selectedItemRef.current?.scrollIntoView({ block: "nearest" });
	}, [isOpen]);

	const fallbackModels = useMemo(
		() => AI_MODELS.map(localizeAiModelOption),
		[currentLanguage],
	);
	const modelList = models.length > 0 ? models : fallbackModels;
	const showSearch = modelList.length > 6;

	const filteredModels = useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return modelList;
		return modelList.filter((model) =>
			[model.name, model.id, model.description, model.badge]
				.filter(Boolean)
				.some((field) => String(field).toLowerCase().includes(q)),
		);
	}, [modelList, searchQuery]);

	if (!isOpen) return null;

	return (
		<div
			className="AiModelSelectorDropdownV2"
			ref={ref}
			role="dialog"
			aria-label={lang.t("Select Gemini model")}
		>
			<div className="AiModelSelectorDropdownV2__header">
				<div className="AiModelSelectorDropdownV2__titleGroup">
					<span className="AiModelSelectorDropdownV2__title">{lang.t("Gemini model")}</span>
					<span className="AiModelSelectorDropdownV2__count">{modelList.length}</span>
				</div>
				<button
					type="button"
					className="AiModelSelectorDropdownV2__closeBtn"
					onClick={onClose}
					aria-label={lang.t("Close model selector")}
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			{showSearch && (
				<div className="AiModelSelectorDropdownV2__searchWrap">
					<input
						type="search"
						className="AiModelSelectorDropdownV2__searchInput"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder={lang.t("Search models...")}
						aria-label={lang.t("Search models")}
					/>
				</div>
			)}

			<div className="AiModelSelectorDropdownV2__list">
				{filteredModels.length === 0 ? (
					<div className="AiModelSelectorDropdownV2__empty">{lang.t("No models found")}</div>
				) : (
					filteredModels.map((model: AiModelOption) => {
						const isSelected = model.id === selectedModel;
						const hasDesc = shouldShowModelDescription(model);
						return (
							<button
								key={model.id}
								ref={isSelected ? selectedItemRef : undefined}
								type="button"
								className={`AiModelSelectorDropdownV2__item ${isSelected ? "is-selected" : ""}`}
								onClick={() => onSelectModel(model.id)}
							>
								<div className="AiModelSelectorDropdownV2__itemRow">
									<div className="AiModelSelectorDropdownV2__nameGroup">
										<span className="AiModelSelectorDropdownV2__name">{model.name}</span>
										{model.badge && (
											<span className="AiModelSelectorDropdownV2__badge">{model.badge}</span>
										)}
									</div>
									<div className="AiModelSelectorDropdownV2__rightMeta">
										{model.contextWindow && (
											<span
												className="AiModelSelectorDropdownV2__contextPill"
												title={lang.t("Context window: {window}", {
													window: model.contextWindow,
												})}
											>
												{formatCompactContextWindow(model.contextWindow)}
											</span>
										)}
										{isSelected && (
											<svg
												className="AiModelSelectorDropdownV2__check"
												width="15"
												height="15"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												strokeWidth="2.5"
											>
												<polyline points="20 6 9 17 4 12" />
											</svg>
										)}
									</div>
								</div>
								{hasDesc && (
									<div className="AiModelSelectorDropdownV2__desc">{model.description}</div>
								)}
							</button>
						);
					})
				)}
			</div>
		</div>
	);
}

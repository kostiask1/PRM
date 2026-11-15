import {
	Fragment,
	useCallback,
	useEffect,
	useRef,
	useState,
	type ChangeEvent,
	type KeyboardEvent as ReactKeyboardEvent,
	type ReactNode,
} from "react";
import {
	Button,
	Icon,
	Modal,
	TextInput,
	Tooltip,
} from "../../../shared/ui/index.js";
import DiceProbabilityModalContent from "./DiceProbabilityModalContent.tsx";
import {
	classNames,
	rollDiceFormula,
	type DiceBreakdownEntry,
} from "../../../shared/lib/index.js";
import { lang } from "../../../shared/lib/index.js";

import "../../../assets/components/DiceCalculator.css";
import {
	addDieToFormula,
	createHistoryRollPayload,
	getCurrentDiceFormula,
	getDiceBreakdownLabel,
	getRechargeResultClass,
	isDicePanelShortcut,
	isPlayerQuestionsRollContext,
	isSingleDieRoll,
	prependDiceHistory,
	readPendingDiceRoll,
	type DiceResultEntry,
} from "../model.ts";
import { useDiceRequestRuntime } from "./DiceRuntime.tsx";

const PLAYER_QUESTIONS_HIDE_DELAY_MS = 2200;
const PANEL_HIDE_ANIMATION_MS = 220;

const DICE_TYPES = [4, 6, 8, 10, 12, 20, 100] as const;

export interface DiceCalculatorProps {
	diceRollRequest: unknown;
	openRequest?: number;
	publishResult(result: DiceResultEntry, context: unknown): void;
}

export default function DiceCalculator({
	diceRollRequest,
	openRequest = 0,
	publishResult,
}: DiceCalculatorProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [modalOwnerId, setModalOwnerId] = useState<string | undefined>();
	const [isPanelMounted, setIsPanelMounted] = useState(false);
	const [isRolling, setIsRolling] = useState(false);
	const [history, setHistory] = useState<DiceResultEntry[]>([]);
	const [lastResult, setLastResult] = useState<DiceResultEntry | null>(null);
	const [manualInput, setManualInput] = useState("");
	const [formulaError, setFormulaError] = useState(false);
	const [probabilityFormula, setProbabilityFormula] = useState("");
	const { requestRoll } = useDiceRequestRuntime();
	const rootRef = useRef<HTMLDivElement>(null);
	const formulaRef = useRef<HTMLInputElement>(null);
	const openingElementRef = useRef<HTMLElement | null>(null);
	const focusedOpenRequestRef = useRef(0);
	const processedRollRequestIdRef = useRef<unknown>(null);
	const rollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const rollingAnimationFrameRef = useRef<number | null>(null);
	const autoCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const panelUnmountTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const formulaHelp = (
		<div className="DiceCalculator__formulaHelp">
			<div className="DiceCalculator__formulaHelpTitle">
				{lang.t("Formula syntax")}
			</div>
			<ul>
				<li>{lang.t("NdM — roll N dice with M sides, e.g. 2d20")}</li>
				<li>{lang.t("+/- number — add or subtract modifiers, e.g. 1d20+5")}</li>
				<li>{lang.t("* and () — multiply and group, e.g. (1d6-1)*100")}</li>
				<li>{lang.t("hN — keep N highest dice, e.g. 5d6h3")}</li>
				<li>{lang.t("lN — keep N lowest dice, e.g. 4d6l2")}</li>
			</ul>
		</div>
	);

	useEffect(() => {
		if (openRequest === 0) return;
		openingElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		setModalOwnerId(undefined);
		if (autoCloseTimeoutRef.current) {
			clearTimeout(autoCloseTimeoutRef.current);
			autoCloseTimeoutRef.current = null;
		}
		setIsOpen(true);
	}, [openRequest]);

	const closeAndRestoreFocus = () => {
		setIsOpen(false);
		if (openingElementRef.current?.isConnected) openingElementRef.current.focus();
	};

	useEffect(() => {
		if (!isOpen || !isPanelMounted || openRequest === 0 || focusedOpenRequestRef.current === openRequest) return;
		focusedOpenRequestRef.current = openRequest;
		formulaRef.current?.focus();
	}, [isOpen, isPanelMounted, openRequest]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (isDicePanelShortcut(event)) {
				event.preventDefault();
				if (!rootRef.current?.contains(document.activeElement)) {
					openingElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
				}
				const dialogs = document.querySelectorAll<HTMLElement>('.Modal__card[role="dialog"]');
				setModalOwnerId(dialogs[dialogs.length - 1]?.id);
				setIsOpen((prev) => !prev);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, []);

	useEffect(() => {
		if (panelUnmountTimeoutRef.current) {
			clearTimeout(panelUnmountTimeoutRef.current);
			panelUnmountTimeoutRef.current = null;
		}

		if (isOpen) {
			setIsPanelMounted(true);
			return undefined;
		}

		panelUnmountTimeoutRef.current = setTimeout(() => {
			setIsPanelMounted(false);
			panelUnmountTimeoutRef.current = null;
		}, PANEL_HIDE_ANIMATION_MS);

		return () => {
			if (panelUnmountTimeoutRef.current) {
				clearTimeout(panelUnmountTimeoutRef.current);
				panelUnmountTimeoutRef.current = null;
			}
		};
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) return undefined;

		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target;
			if (target instanceof Node && rootRef.current?.contains(target)) return;
			if (target instanceof Element && target.closest(".RollDice")) return;
			if (target instanceof Element && target.closest(".DiceCalculator__probabilityOverlay")) return;
			if (
				target instanceof Element &&
				target.closest(".MonsterStatBlock__ability_box")
			)
				return;
			setIsOpen(false);
		};

		document.addEventListener("pointerdown", handlePointerDown);
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown);
		};
	}, [isOpen]);

	useEffect(
		() => () => {
			if (rollingTimeoutRef.current) {
				clearTimeout(rollingTimeoutRef.current);
			}
			if (autoCloseTimeoutRef.current) {
				clearTimeout(autoCloseTimeoutRef.current);
			}
			if (panelUnmountTimeoutRef.current) {
				clearTimeout(panelUnmountTimeoutRef.current);
			}
			if (rollingAnimationFrameRef.current) {
				cancelAnimationFrame(rollingAnimationFrameRef.current);
			}
		},
		[],
	);

	const parseAndRoll = useCallback(
		(str: unknown, context: unknown = null) => {
			if (!str) return;
			if (!rootRef.current?.contains(document.activeElement)) {
				openingElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			}
			const dialogs = document.querySelectorAll<HTMLElement>('.Modal__card[role="dialog"]');
			setModalOwnerId(dialogs[dialogs.length - 1]?.id);

			const entry = rollDiceFormula(str);
			if (!entry || !entry.formula) {
				setFormulaError(true);
				setIsOpen(true);
				return;
			}
			setFormulaError(false);

			if (rollingTimeoutRef.current) {
				clearTimeout(rollingTimeoutRef.current);
			}
			if (rollingAnimationFrameRef.current) {
				cancelAnimationFrame(rollingAnimationFrameRef.current);
			}

			setIsRolling(false);
			rollingAnimationFrameRef.current = requestAnimationFrame(() => {
				rollingAnimationFrameRef.current = requestAnimationFrame(() => {
					setIsRolling(true);
					rollingTimeoutRef.current = setTimeout(() => {
						setIsRolling(false);
						rollingTimeoutRef.current = null;
					}, 420);
					rollingAnimationFrameRef.current = null;
				});
			});

			const resultEntry: DiceResultEntry = context
				? { ...entry, context }
				: entry;
			setLastResult(resultEntry);
			setHistory((prev) => prependDiceHistory(prev, resultEntry));
			setIsOpen(true);
			publishResult(resultEntry, context);

			if (autoCloseTimeoutRef.current) {
				clearTimeout(autoCloseTimeoutRef.current);
				autoCloseTimeoutRef.current = null;
			}
			if (isPlayerQuestionsRollContext(context)) {
				autoCloseTimeoutRef.current = setTimeout(() => {
					setIsOpen(false);
					autoCloseTimeoutRef.current = null;
				}, PLAYER_QUESTIONS_HIDE_DELAY_MS);
			}
		},
		[publishResult],
	);

	useEffect(() => {
		const pendingRoll = readPendingDiceRoll(diceRollRequest);
		if (
			!pendingRoll ||
			processedRollRequestIdRef.current === pendingRoll.requestId
		)
			return;

		processedRollRequestIdRef.current = pendingRoll.requestId;
		if (pendingRoll.formula === null) return;
		parseAndRoll(pendingRoll.formula, pendingRoll.context);
	}, [diceRollRequest, parseAndRoll]);

	const addToFormula = (type: "die", value: number) => {
		if (type === "die") {
			setFormulaError(false);
			if (lastResult) {
				setLastResult(null);
				setManualInput("");
			}
			setManualInput((prev) => addDieToFormula(prev, value));
		}
	};

	const clearFormula = () => {
		setManualInput("");
		setLastResult(null);
		setFormulaError(false);
	};

	const executeRoll = () => {
		const trimmedInput = manualInput.trim();
		if (trimmedInput) {
			requestRoll(trimmedInput);
		}
	};

	const openProbabilityModal = () => {
		const formula = getCurrentDiceFormula(manualInput, lastResult);
		if (!formula) return;
		setProbabilityFormula(formula);
	};

	const clearHistory = () => {
		setHistory([]);
		setLastResult(null);
	};

	const renderBreakdown = useCallback((
		breakdown: DiceBreakdownEntry[],
		result: DiceResultEntry | null = null,
	): ReactNode => {
		const limit = 10;
		const itemsToShow = breakdown.slice(0, limit);
		const hasMore = breakdown.length > limit;

		const content = itemsToShow.map((item, idx) => {
			const isMin = item.max && item.val === 1;
			const isMax = item.max && item.val === item.max;
			let dynamicClassName = isMin ? "DiceCalculator__min" : isMax ? "DiceCalculator__max" : "";
			const rechargeClass = getRechargeResultClass(result, item.val);
			if (rechargeClass) dynamicClassName = rechargeClass;
			if (item.dropped) dynamicClassName += " DiceCalculator__dropped";

			const sign = idx > 0 && item.val >= 0 ? " + " : "";
			return (
				<Fragment key={idx}>
					{sign}
					<span className={dynamicClassName}>{item.val}</span>
				</Fragment>
			);
		});

		if (hasMore) {
			content.push(
				<span key="more" className="muted">
					{" "}
					+ ...
				</span>,
			);
		}

		return content;
	}, []);

	const getPotentialRangeLabel = useCallback((result: DiceResultEntry) => {
		return `${lang.t("Min")} ${result.min} / ${lang.t("Avg")} ${
			result.average
		} / ${lang.t("Max")} ${result.max}`;
	}, []);

	const renderHistoryBreakdown = useCallback(
		(roll: DiceResultEntry): ReactNode => {
			if (isSingleDieRoll(roll)) return null;
			if (roll.expressionBreakdown) {
				return <span className="muted">({roll.expressionBreakdown})</span>;
			}
			return (
				<span className="muted">({renderBreakdown(roll.breakdown, roll)})</span>
			);
		},
		[renderBreakdown],
	);

	return (
		<div
			ref={rootRef}
			className={classNames("DiceCalculator", { is_open: isOpen })}
			data-modal-owner={isOpen ? modalOwnerId : undefined}
			onKeyDown={(event) => {
				if (event.key === "Escape" && isOpen && !probabilityFormula) {
					event.preventDefault();
					event.stopPropagation();
					closeAndRestoreFocus();
				}
			}}
		>
			{isPanelMounted && (
				<div
					className={classNames("DiceCalculator__panel", {
						is_closing: !isOpen,
					})}
				>
					<div className="DiceCalculator__header">
						<span>{lang.t("Dice calculator")}</span>
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							icon="x"
							aria-label={lang.t("Close")}
							onClick={closeAndRestoreFocus}
						/>
					</div>

					<div
						className={classNames("DiceCalculator__display", {
							is_rolling: isRolling,
						})}
					>
						{lastResult ? (
							<div className="DiceCalculator__lastResult">
								<Tooltip
									delay={500}
									content={`${lastResult.formula} (${getDiceBreakdownLabel(lastResult)})`}
								>
									<div className="DiceCalculator__formulaLabel">
										{lastResult.formula} (
										<Tooltip delay={500} content={lang.t("Rolled values")}>
											{lastResult.expressionBreakdown ||
												renderBreakdown(
													lastResult.breakdown,
													lastResult,
												)}
											)
										</Tooltip>
									</div>
								</Tooltip>
								<div className="DiceCalculator__totalValue_container">
									<span
										className={classNames("DiceCalculator__totalValue", {
											[getRechargeResultClass(lastResult)]:
												Boolean(getRechargeResultClass(lastResult)),
											DiceCalculator__max:
												lastResult.isCritical && lastResult.total === 20,
											DiceCalculator__min:
												lastResult.isCritical && lastResult.total !== 20,
										})}
									>
										={lastResult.total}
										{lastResult.average !== undefined && (
											<Tooltip
												delay={500}
												content={getPotentialRangeLabel(lastResult)}
											>
												<span className="DiceCalculator__averageValue">
													<span className="DiceCalculator__min">{lastResult.min}</span>
													<span>/</span>
													<span>{lastResult.average}</span>
													<span>/</span>
													<span className="DiceCalculator__max">{lastResult.max}</span>
												</span>
											</Tooltip>
										)}
									</span>
								</div>
							</div>
						) : (
							<div>
								{lang.t("Waiting...")}
							</div>
						)}
					</div>

					<div className="DiceCalculator__manual">
						<TextInput
							ref={formulaRef}
							aria-label={lang.t("Dice formula")}
							placeholder={lang.t("Formula (e.g. 1d12+5)")}
							value={manualInput}
							aria-invalid={formulaError}
							onChange={(event: ChangeEvent<HTMLInputElement>) => {
								setManualInput(event.target.value);
								setFormulaError(false);
							}}
							onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
								if (event.key === "Enter" && manualInput.trim()) {
									requestRoll(manualInput);
								}
							}}
						/>
						<Tooltip content={formulaHelp} delay={200}>
							<span
								className="DiceCalculator__helpIcon"
								tabIndex={0}
								aria-label={lang.t("Formula syntax")}
							>
								<Icon name="help" size={18} />
							</span>
						</Tooltip>
					</div>
					{formulaError && <div className="DiceCalculator__formulaError" role="alert">{lang.t("Invalid dice formula. Check the syntax and try again.")}</div>}

					<div>
						<div className="DiceCalculator__group">
							{DICE_TYPES.map((sides) => (
								<Button
									key={sides}
									variant="ghost"
									size={Button.SIZES.SMALL}
									onClick={() => addToFormula("die", sides)}
								>
									d{sides}
								</Button>
							))}
						</div>
					</div>
					<div className="DiceCalculator__actions">
						<Button
							variant="danger"
							size={Button.SIZES.MEDIUM}
							onClick={clearFormula}
							aria-label={lang.t("Clear formula")}
						>
							{lang.t("Clear")}
						</Button>
						<Button
							variant="ghost"
							size={Button.SIZES.MEDIUM}
							icon="bar-chart"
							title={lang.t("Probability graph")}
							onClick={openProbabilityModal}
							disabled={!getCurrentDiceFormula(manualInput, lastResult)}
						>
							{lang.t("Graph")}
						</Button>
						<Button
							variant="primary"
							className="DiceCalculator__rollBtn"
							onClick={executeRoll}
							disabled={!manualInput.trim()}
						>
							{lang.t("ROLL")}
						</Button>
					</div>

					<div className="DiceCalculator__history">
						<div className="DiceCalculator__historyHeader">
							<span>{lang.t("History")}</span>
							<button
								type="button"
								onClick={clearHistory}
								disabled={history.length === 0}
								aria-label={lang.t("Clear roll history")}
								className="DiceCalculator__clearHistoryBtn"
							>
								{lang.t("Clear")}
							</button>
						</div>
						<div className="DiceCalculator__historyList">
							{history.map((roll) => (
								<button
									type="button"
									className="DiceCalculator__historyItem"
									onClick={() =>
										requestRoll(createHistoryRollPayload(roll))
									}
									onKeyDown={(event) => {
										if (event.key !== "Enter" || event.repeat) return;
										event.preventDefault();
										requestRoll(createHistoryRollPayload(roll));
									}}
									key={roll.id}
								>
									<Tooltip
										delay={750}
										content={`${roll.formula} = ${roll.total} (${getDiceBreakdownLabel(roll)})`}
									>
										<div className="DiceCalculator__historyInfo">
											<span>
												<strong>
													{roll.formula} =
													<span
														className={
															getRechargeResultClass(roll) ||
															(roll.isCritical
																? roll.total === 20
															? "DiceCalculator__max"
															: "DiceCalculator__min"
																: "")
														}
													>
														{" "}
														{roll.total}
													</span>
												</strong>
											</span>
											{renderHistoryBreakdown(roll)}
										</div>
									</Tooltip>
								</button>
							))}
						</div>
					</div>
				</div>
			)}
			<Tooltip content="CTRL+D">
				<button
					type="button"
					aria-label={lang.t("Dice calculator")}
					aria-expanded={isOpen}
					className={classNames("DiceCalculator__toggle", {
						is_rolling: isRolling,
					})}
					onClick={(event) => {
						if (!isOpen) openingElementRef.current = event.currentTarget;
						setIsOpen(!isOpen);
					}}
				>
					<Icon
						name="dice"
						size={28}
						className={classNames("DiceCalculator__toggleIcon", {
							is_rolling: isRolling,
						})}
					/>
				</button>
			</Tooltip>
			{probabilityFormula && (
				<Modal
					title={lang.t("Probability graph")}
					type="custom"
					showFooter={false}
					className="DiceCalculator__probabilityModal"
					overlayClassName="DiceCalculator__probabilityOverlay"
					onCancel={() => setProbabilityFormula("")}
					onConfirm={() => setProbabilityFormula("")}
				>
					<DiceProbabilityModalContent formula={probabilityFormula} />
				</Modal>
			)}
		</div>
	);
}

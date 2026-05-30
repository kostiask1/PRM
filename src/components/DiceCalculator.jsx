import React, { useCallback, useEffect, useRef, useState } from "react";
import Button from "./form/Button";
import Input from "./form/Input";
import Icon from "./common/Icon";
import Tooltip from "./common/Tooltip";
import { publishDiceResultAction, requestDiceRollAction } from "../actions/app";
import { rollDiceFormula } from "../utils/dice";
import { useAppDispatch, useAppSelector } from "../store/appStore";
import classNames from "../utils/classNames";
import { lang } from "../services/localization";

import "../assets/components/DiceCalculator.css";

const PLAYER_QUESTIONS_ROLL_CONTEXT = "playerQuestions";
const PLAYER_QUESTIONS_HIDE_DELAY_MS = 2200;
const PANEL_HIDE_ANIMATION_MS = 220;

function isSingleDieRoll(result) {
	return (
		/^1d\d+$/i.test(String(result?.formula || "").replace(/\s+/g, "")) &&
		Array.isArray(result?.breakdown) &&
		result.breakdown.length === 1 &&
		result.breakdown[0]?.max
	);
}

export default function DiceCalculator() {
	const [isOpen, setIsOpen] = useState(false);
	const [isPanelMounted, setIsPanelMounted] = useState(false);
	const [isRolling, setIsRolling] = useState(false);
	const [history, setHistory] = useState([]);
	const [lastResult, setLastResult] = useState(null);
	const [manualInput, setManualInput] = useState("");
	const dispatch = useAppDispatch();
	const diceRollRequest = useAppSelector((state) => state.dice.rollRequest);
	const rootRef = useRef(null);
	const processedRollRequestIdRef = useRef(null);
	const rollingTimeoutRef = useRef(null);
	const rollingAnimationFrameRef = useRef(null);
	const autoCloseTimeoutRef = useRef(null);
	const panelUnmountTimeoutRef = useRef(null);

	const diceTypes = [4, 6, 8, 10, 12, 20, 100];
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
		const handleKeyDown = (e) => {
			if (
				(e.ctrlKey || e.metaKey) &&
				(e.key.toLowerCase() === "d" || e.key.toLowerCase() === "в")
			) {
				e.preventDefault();
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

		const handlePointerDown = (e) => {
			if (rootRef.current?.contains(e.target)) return;
			if (e.target.closest?.(".RollDice")) return;
			if (e.target.closest?.(".MonsterStatBlock__ability_box")) return;
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
		(str, context = null) => {
			if (!str) return;

			const entry = rollDiceFormula(str);
			if (!entry) return;

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

			setLastResult(entry);
			setHistory((prev) => [entry, ...prev].slice(0, 10));
			setIsOpen(true);
			dispatch(publishDiceResultAction(entry, context));

			if (autoCloseTimeoutRef.current) {
				clearTimeout(autoCloseTimeoutRef.current);
				autoCloseTimeoutRef.current = null;
			}
			if (context?.type === PLAYER_QUESTIONS_ROLL_CONTEXT) {
				autoCloseTimeoutRef.current = setTimeout(() => {
					setIsOpen(false);
					autoCloseTimeoutRef.current = null;
				}, PLAYER_QUESTIONS_HIDE_DELAY_MS);
			}
		},
		[dispatch],
	);

	useEffect(() => {
		const requestId = diceRollRequest?.requestId;
		if (!requestId || processedRollRequestIdRef.current === requestId) return;

		processedRollRequestIdRef.current = requestId;
		const detail = diceRollRequest?.data;
		if (!detail) return;

		if (typeof detail === "string") {
			parseAndRoll(detail);
			return;
		}

		if (typeof detail === "object") {
			const formula = detail.formula || detail.value || "";
			parseAndRoll(formula, detail.context || null);
		}
	}, [diceRollRequest, parseAndRoll]);

	const addToFormula = (type, value) => {
		if (type === "die") {
			if (lastResult) {
				setLastResult(null);
				setManualInput("");
			}
			setManualInput((prev) => {
				const currentInput = prev.trim();
				const dieRegex = new RegExp(`(?:(\\d+))?d${value}(\\b)`, "i");
				const match = currentInput.match(dieRegex);

				if (match) {
					const currentCount = parseInt(match[1] || "1", 10);
					return currentInput.replace(dieRegex, `${currentCount + 1}d${value}`);
				}

				const dieStr = `1d${value}`;
				if (currentInput === "" || /[+\-*/]$/.test(currentInput)) {
					return `${currentInput}${dieStr}`;
				}
				return `${currentInput}+${dieStr}`;
			});
		}
	};

	const clearFormula = () => {
		setManualInput("");
		setLastResult(null);
	};

	const executeRoll = () => {
		const trimmedInput = manualInput.trim();
		if (trimmedInput) {
			dispatch(requestDiceRollAction(trimmedInput));
		}
	};

	const clearHistory = () => {
		setHistory([]);
		setLastResult(null);
	};

	const renderBreakdown = useCallback((breakdown) => {
		if (!Array.isArray(breakdown)) return breakdown;

		const limit = 10;
		const itemsToShow = breakdown.slice(0, limit);
		const hasMore = breakdown.length > limit;

		const content = itemsToShow.map((item, idx) => {
			const isMin = item.max && item.val === 1;
			const isMax = item.max && item.val === item.max;
			let dynamicClassName = isMin ? "dice_min" : isMax ? "dice_max" : "";
			if (item.dropped) dynamicClassName += " dice_dropped";

			const sign = idx > 0 && item.val >= 0 ? " + " : "";
			return (
				<React.Fragment key={idx}>
					{sign}
					<span className={dynamicClassName}>{item.val}</span>
				</React.Fragment>
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

	const getFullBreakdownString = useCallback((breakdown) => {
		if (!Array.isArray(breakdown)) return "";
		return breakdown
			.map((item, idx) => {
				const isNegative = item.val < 0;
				const sign =
					idx > 0 ? (isNegative ? " - " : " + ") : isNegative ? "-" : "";
				const valueToShow = Math.abs(item.val);
				const text = item.dropped ? `[${valueToShow}]` : valueToShow;
				return `${sign}${text}`;
			})
			.join("");
	}, []);

	const getRollBreakdownLabel = useCallback(
		(result) => {
			return result?.expressionBreakdown || getFullBreakdownString(result?.breakdown);
		},
		[getFullBreakdownString],
	);

	const getPotentialRangeLabel = useCallback((result) => {
		if (result?.min === undefined || result?.max === undefined) return "";
		return `${lang.t("Min")} ${result.min} / ${lang.t("Avg")} ${
			result.average
		} / ${lang.t("Max")} ${result.max}`;
	}, []);

	const renderHistoryBreakdown = useCallback(
		(roll) => {
			if (isSingleDieRoll(roll)) return null;
			if (roll.expressionBreakdown) {
				return <span className="muted">({roll.expressionBreakdown})</span>;
			}
			return <span className="muted">({renderBreakdown(roll.breakdown)})</span>;
		},
		[renderBreakdown],
	);

	return (
		<div
			ref={rootRef}
			className={classNames("DiceCalculator", { is_open: isOpen })}
		>
			{isPanelMounted && (
				<div
					className={classNames("DiceCalculator__panel", {
						is_closing: !isOpen,
					})}
				>
					<div className="DiceCalculator__header">
						<span>{lang.t("Dice Roller")}</span>
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							icon="x"
							onClick={() => setIsOpen(false)}
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
									content={`${lastResult.formula} (${getRollBreakdownLabel(lastResult)})`}
								>
									<div className="DiceCalculator__formulaLabel">
										{lastResult.formula} (
										<Tooltip delay={500} content={lang.t("Rolled values")}>
											{lastResult.expressionBreakdown ||
												renderBreakdown(lastResult.breakdown)}
											)
										</Tooltip>
									</div>
								</Tooltip>
								<div className="DiceCalculator__totalValue_container">
									<span
										className={classNames("DiceCalculator__totalValue", {
											dice_max:
												lastResult.isCritical && lastResult.total === 20,
											dice_min:
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
													<span className="dice_min">{lastResult.min}</span>
													<span>/</span>
													<span>{lastResult.average}</span>
													<span>/</span>
													<span className="dice_max">{lastResult.max}</span>
												</span>
											</Tooltip>
										)}
									</span>
								</div>
							</div>
						) : (
							<div className="DiceCalculator__placeholder">
								{lang.t("Waiting...")}
							</div>
						)}
					</div>

					<div className="DiceCalculator__manual">
						<Input
							placeholder={lang.t("Formula (e.g. 1d12+5)")}
							value={manualInput}
							onChange={(e) => setManualInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && manualInput.trim()) {
									dispatch(requestDiceRollAction(manualInput));
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

					<div className="DiceCalculator__controls">
						<div className="DiceCalculator__group">
							{diceTypes.map((sides) => (
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
							size={Button.SIZES.SMALL}
							onClick={clearFormula}
						>
							{lang.t("Clear")}
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
								onClick={clearHistory}
								className="DiceCalculator__clearHistoryBtn"
							>
								{lang.t("Clear")}
							</button>
						</div>
						<div className="DiceCalculator__historyList">
							{history.map((roll) => (
								<div
									className="DiceCalculator__historyItem"
									onClick={() => dispatch(requestDiceRollAction(roll.formula))}
									key={roll.id}
								>
									<Tooltip
										delay={750}
										content={`${roll.formula} = ${roll.total} (${getRollBreakdownLabel(roll)})`}
									>
										<div className="DiceCalculator__historyInfo">
											<span>
												<strong>
													{roll.formula} =
													<span
														className={
															roll.isCritical
																? roll.total === 20
																	? "dice_max"
																	: "dice_min"
																: ""
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
								</div>
							))}
						</div>
					</div>
				</div>
			)}
			<Tooltip content="CTRL+D">
				<button
					className={classNames("DiceCalculator__toggle", {
						is_rolling: isRolling,
					})}
					onClick={() => setIsOpen(!isOpen)}
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
		</div>
	);
}

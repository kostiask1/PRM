import React, { useState, useEffect, useCallback } from "react";
import Button from "./Button";
import Input from "./Input";
import Icon from "./Icon";
import Tooltip from "./Tooltip";
import { rollDiceFormula } from "../utils/dice";
import { DICE_ROLL_EVENT, DICE_ROLLED_EVENT } from "../utils/diceEvents";

import "../assets/components/DiceCalculator.css";

export default function DiceCalculator() {
	const [isOpen, setIsOpen] = useState(false);
	const [history, setHistory] = useState([]);
	const [lastResult, setLastResult] = useState(null);
	const [manualInput, setManualInput] = useState("");

	const diceTypes = [4, 6, 8, 10, 12, 20, 100];

	useEffect(() => {
		const handleKeyDown = (e) => {
			// Перевіряємо Ctrl+D (або Cmd+D для Mac)
			if (
				(e.ctrlKey || e.metaKey) &&
				(e.key.toLowerCase() === "d" || e.key.toLowerCase() === "в")
			) {
				e.preventDefault(); // Запобігаємо відкриттю вікна закладок браузера
				setIsOpen((prev) => !prev);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, []);

	const parseAndRoll = useCallback((str, context = null) => {
		if (!str) return;

		const entry = rollDiceFormula(str);
		if (!entry) return;

		setLastResult(entry);
		setHistory((prev) => [entry, ...prev].slice(0, 10));
		setIsOpen(true);
		window.dispatchEvent(
			new CustomEvent(DICE_ROLLED_EVENT, {
				detail: { result: entry, context },
			}),
		);
	}, []);

	useEffect(() => {
		const handleRollDiceEvent = (event) => {
			const detail = event.detail;
			if (!detail) return;

			if (typeof detail === "string") {
				parseAndRoll(detail);
				return;
			}

			if (typeof detail === "object") {
				const formula = detail.formula || detail.value || "";
				parseAndRoll(formula, detail.context || null);
			}
		};

		window.addEventListener(DICE_ROLL_EVENT, handleRollDiceEvent);
		return () => {
			window.removeEventListener(DICE_ROLL_EVENT, handleRollDiceEvent);
		};
	}, [parseAndRoll]);

	const addToFormula = (type, value) => {
		if (type === "die") {
			if (lastResult) {
				// Якщо був попередній кидок, очищуємо все для нової формули
				setLastResult(null);
				setManualInput("");
			}
			setManualInput((prev) => {
				const currentInput = prev.trim();
				const dieRegex = new RegExp(`(?:(\\d+))?d${value}(\\b)`, "i");
				const match = currentInput.match(dieRegex);

				if (match) {
					const currentCount = parseInt(match[1] || "1");
					return currentInput.replace(dieRegex, `${currentCount + 1}d${value}`);
				} else {
					const dieStr = `1d${value}`;
					if (currentInput === "" || /[+\-*/]$/.test(currentInput)) {
						return `${currentInput}${dieStr}`;
					}
					return `${currentInput}+${dieStr}`;
				}
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
			parseAndRoll(trimmedInput);
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
			let className = isMin ? "dice-min" : isMax ? "dice-max" : "";
			if (item.dropped) className += " dice-dropped";

			const sign = idx > 0 && item.val >= 0 ? " + " : "";
			return (
				<React.Fragment key={idx}>
					{sign}
					<span className={className}>
						{item.dropped ? item.val : item.val}
					</span>
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

	return (
		<div className={`DiceCalculator ${isOpen ? "is-open" : ""}`}>
			{isOpen && (
				<div className="DiceCalculator__panel">
					<div className="DiceCalculator__header">
						<span>Dice Roller</span>
						<Button
							variant="ghost"
							size="small"
							icon="x"
							onClick={() => setIsOpen(false)}
						/>
					</div>

					<div className="DiceCalculator__display">
						{lastResult ? (
							<div className="DiceCalculator__lastResult">
								<Tooltip
									delay={500}
									content={`${lastResult.formula} (${getFullBreakdownString(lastResult.breakdown)})`}>
									<div className="DiceCalculator__formulaLabel">
										{lastResult.formula} (
										{renderBreakdown(lastResult.breakdown)})
									</div>
								</Tooltip>
								<div className="DiceCalculator__totalValue-container">
									<span
										className={`DiceCalculator__totalValue ${lastResult.isCritical ? (lastResult.total === 20 ? "dice-max" : "dice-min") : ""}`}>
										{lastResult.total}
									</span>
									{lastResult.average !== undefined && (
										<span className="DiceCalculator__averageValue">
											({lastResult.average})
										</span>
									)}
								</div>
							</div>
						) : (
							<div className="DiceCalculator__placeholder">Очікування...</div>
						)}
					</div>

					<div className="DiceCalculator__manual">
						<Input
							placeholder="Формула (напр. 1d12+5)"
							value={manualInput}
							onChange={(e) => setManualInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && manualInput.trim()) {
									parseAndRoll(manualInput);
								}
							}}
						/>
					</div>

					<div className="DiceCalculator__controls">
						<div className="DiceCalculator__group">
							{diceTypes.map((sides) => (
								<Button
									key={sides}
									variant="ghost"
									size="small"
									onClick={() => addToFormula("die", sides)}>
									d{sides}
								</Button>
							))}
						</div>
					</div>
					<div className="DiceCalculator__actions">
						<Button variant="danger" size="small" onClick={clearFormula}>
							Clear
						</Button>
						<Button
							variant="primary"
							className="DiceCalculator__rollBtn"
							onClick={executeRoll}
							disabled={!manualInput.trim()}>
							ROLL
						</Button>
					</div>

					{history.length > 0 && (
						<div className="DiceCalculator__history">
							<div className="DiceCalculator__historyHeader">
								<span>Історія</span>
								<button
									onClick={clearHistory}
									className="DiceCalculator__clearHistoryBtn">
									Очистити
								</button>
							</div>
							<div className="DiceCalculator__historyList">
								{history.map((roll) => (
									<div
										className="DiceCalculator__historyItem"
										onClick={() => parseAndRoll(roll.formula)}
										key={roll.id}>
										<Tooltip
											delay={750}
											content={`${roll.formula} = ${roll.total} (${getFullBreakdownString(roll.breakdown)})`}>
											<div className="DiceCalculator__historyInfo">
												<span>
													<strong>
														{roll.formula} =
														<span
															className={
																roll.isCritical
																	? roll.total === 20
																		? "dice-max"
																		: "dice-min"
																	: ""
															}>
															{" "}
															{roll.total}
														</span>
													</strong>
												</span>
												<span className="muted">
													({renderBreakdown(roll.breakdown)})
												</span>
											</div>
										</Tooltip>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}
			<Tooltip content="CTRL+D" delay={500}>
				<button
					className="DiceCalculator__toggle"
					onClick={() => setIsOpen(!isOpen)}>
					<Icon name="dice" size={28} />
				</button>
			</Tooltip>
		</div>
	);
}

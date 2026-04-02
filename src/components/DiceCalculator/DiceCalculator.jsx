import React, { useState, useEffect, useCallback } from "react";
import Button from "../Button/Button";
import Input from "../Input/Input";
import Icon from "../Icon";

import "./DiceCalculator.css";

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

	const parseAndRoll = useCallback((str) => {
		if (!str) return;

		const cleanStr = str.toLowerCase().replace(/\s+/g, "");
		// Підтримка віднімання та від'ємних модифікаторів
		const normalizedStr = cleanStr.replace(/-/g, "+-");
		const parts = normalizedStr.split("+").filter(Boolean);

		let diceTotal = 0;
		let modifierSum = 0;
		let averageTotal = 0;
		const details = [];
		const diceMap = {}; // Об'єкт для групування кубиків (включаючи h/l)

		let d20Count = 0;
		let lastD20Value = 0;

		parts.forEach((part) => {
			const dieMatch = part.match(/^(\d+)?d(\d+)([hl]\d+)?$/i);
			if (dieMatch) {
				const count = parseInt(dieMatch[1]) || 1;
				const sides = parseInt(dieMatch[2]);
				const keepSuffix = dieMatch[3]; // h3 або l2

				// Додаємо до групи
				const groupKey = `${sides}${keepSuffix || ""}`;
				diceMap[groupKey] = (diceMap[groupKey] || 0) + count;

				const currentRolls = [];
				for (let i = 0; i < count; i++) {
					const roll = Math.floor(Math.random() * sides) + 1;
					currentRolls.push({ val: roll, max: sides });

					if (sides === 20 && !keepSuffix) {
						d20Count++;
						lastD20Value = roll;
					}
				}

				if (keepSuffix) {
					const type = keepSuffix[0].toLowerCase();
					const keepCount = Math.min(parseInt(keepSuffix.slice(1)), count);

					// Сортуємо індекси, щоб помітити, які кубики скинути
					const indexed = currentRolls.map((r, idx) => ({ val: r.val, idx }));
					indexed.sort((a, b) =>
						type === "h" ? b.val - a.val : a.val - b.val,
					);

					const keptIndices = new Set(
						indexed.slice(0, keepCount).map((r) => r.idx),
					);

					currentRolls.forEach((r, idx) => {
						if (keptIndices.has(idx)) {
							diceTotal += r.val;
							averageTotal += (sides + 1) / 2;
						} else {
							r.dropped = true;
						}
						details.push(r);
					});
				} else {
					currentRolls.forEach((r) => {
						diceTotal += r.val;
						averageTotal += (sides + 1) / 2;
						details.push(r);
					});
				}
			} else {
				const num = parseInt(part);
				if (!isNaN(num)) {
					modifierSum += num;
					averageTotal += num;
					details.push({ val: num, max: null });
				}
			}
		});

		// Формуємо фінальну згруповану формулу
		const formulaParts = [];
		// Сортуємо кубики за кількістю граней (від d20 до d4)
		Object.keys(diceMap)
			.sort((a, b) => parseInt(b) - parseInt(a))
			.forEach((key) => {
				const count = diceMap[key];
				formulaParts.push(`${count}d${key}`);
			});

		if (modifierSum !== 0) {
			formulaParts.push(modifierSum);
		}

		// Правило критичного результату для 1d20
		const isCritical =
			d20Count === 1 && (lastD20Value === 1 || lastD20Value === 20);
		const finalTotal = isCritical ? lastD20Value : diceTotal + modifierSum;

		const entry = {
			id: Date.now(),
			formula: formulaParts.join(" + ").replace(/\+\s-/g, "- "),
			breakdown: details,
			total: finalTotal,
			average: Math.floor(averageTotal),
			isCritical: isCritical,
		};

		setLastResult(entry);
		setHistory((prev) => [entry, ...prev].slice(0, 10));
		setIsOpen(true);
	}, []);

	useEffect(() => {
		const handleRollDiceEvent = (event) => {
			if (event.detail) {
				parseAndRoll(event.detail);
			}
		};

		window.addEventListener("rollDice", handleRollDiceEvent);
		return () => {
			window.removeEventListener("rollDice", handleRollDiceEvent);
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
								<div
									className="DiceCalculator__formulaLabel"
									title={`${lastResult.formula} (${getFullBreakdownString(lastResult.breakdown)})`}>
									{lastResult.formula} ({renderBreakdown(lastResult.breakdown)})
								</div>
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
										key={roll.id}
										className="DiceCalculator__historyItem"
										onClick={() => parseAndRoll(roll.formula)}
										title="Натисніть, щоб перекинути">
										<div
											className="DiceCalculator__historyInfo"
											title={`${roll.formula} = ${roll.total} (${getFullBreakdownString(roll.breakdown)})`}>
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
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}
			<button
				className="DiceCalculator__toggle"
				onClick={() => setIsOpen(!isOpen)}
				title="Калькулятор кубиків">
				<Icon name="dice" size={28} />
			</button>
		</div>
	);
}

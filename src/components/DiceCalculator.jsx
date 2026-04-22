import React, { useCallback, useEffect, useRef, useState } from "react";
import Button from "./form/Button";
import Input from "./form/Input";
import Icon from "./common/Icon";
import Tooltip from "./common/Tooltip";
import { publishDiceResultAction, requestDiceRollAction } from "../actions/app";
import { rollDiceFormula } from "../utils/dice";
import { useAppDispatch, useAppSelector } from "../store/appStore";
import classNames from "../utils/classNames";

import "../assets/components/DiceCalculator.css";

export default function DiceCalculator() {
	const [isOpen, setIsOpen] = useState(false);
	const [history, setHistory] = useState([]);
	const [lastResult, setLastResult] = useState(null);
	const [manualInput, setManualInput] = useState("");
	const dispatch = useAppDispatch();
	const diceRollRequest = useAppSelector((state) => state.dice.rollRequest);
	const processedRollRequestIdRef = useRef(null);

	const diceTypes = [4, 6, 8, 10, 12, 20, 100];

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

	const parseAndRoll = useCallback(
		(str, context = null) => {
			if (!str) return;

			const entry = rollDiceFormula(str);
			if (!entry) return;

			setLastResult(entry);
			setHistory((prev) => [entry, ...prev].slice(0, 10));
			setIsOpen(true);
			dispatch(publishDiceResultAction(entry, context));
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
			let dynamicClassName = isMin ? "dice-min" : isMax ? "dice-max" : "";
			if (item.dropped) dynamicClassName += " dice-dropped";

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

	return (
		<div className={classNames("DiceCalculator", { "is-open": isOpen })}>
			{isOpen && (
				<div className="DiceCalculator__panel">
					<div className="DiceCalculator__header">
						<span>Dice Roller</span>
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							icon="x"
							onClick={() => setIsOpen(false)}
						/>
					</div>

					<div className="DiceCalculator__display">
						{lastResult ? (
							<div className="DiceCalculator__lastResult">
								<Tooltip
									delay={500}
									content={`${lastResult.formula} (${getFullBreakdownString(lastResult.breakdown)})`}
								>
									<div className="DiceCalculator__formulaLabel">
										{lastResult.formula} (
										{renderBreakdown(lastResult.breakdown)})
									</div>
								</Tooltip>
								<div className="DiceCalculator__totalValue-container">
									<span
										className={classNames("DiceCalculator__totalValue", {
											"dice-max":
												lastResult.isCritical && lastResult.total === 20,
											"dice-min":
												lastResult.isCritical && lastResult.total !== 20,
										})}
									>
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
									dispatch(requestDiceRollAction(manualInput));
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
							Clear
						</Button>
						<Button
							variant="primary"
							className="DiceCalculator__rollBtn"
							onClick={executeRoll}
							disabled={!manualInput.trim()}
						>
							ROLL
						</Button>
					</div>

					{history.length > 0 && (
						<div className="DiceCalculator__history">
							<div className="DiceCalculator__historyHeader">
								<span>Історія</span>
								<button
									onClick={clearHistory}
									className="DiceCalculator__clearHistoryBtn"
								>
									Очистити
								</button>
							</div>
							<div className="DiceCalculator__historyList">
								{history.map((roll) => (
									<div
										className="DiceCalculator__historyItem"
										onClick={() =>
											dispatch(requestDiceRollAction(roll.formula))
										}
										key={roll.id}
									>
										<Tooltip
											delay={750}
											content={`${roll.formula} = ${roll.total} (${getFullBreakdownString(roll.breakdown)})`}
										>
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
															}
														>
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
			<Tooltip content="CTRL+D">
				<button
					className="DiceCalculator__toggle"
					onClick={() => setIsOpen(!isOpen)}
				>
					<Icon name="dice" size={28} />
				</button>
			</Tooltip>
		</div>
	);
}

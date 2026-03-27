import React, { useState, useEffect, useCallback } from 'react';
import Button from '../Button/Button';
import Input from '../Input/Input';
import Icon from '../Icon';
import './DiceCalculator.css';

export default function DiceCalculator() {
    const [isOpen, setIsOpen] = useState(false);
    const [history, setHistory] = useState([]);
    const [formula, setFormula] = useState([]); // [{type: 'die', value: 20}]
    const [modifier, setModifier] = useState(0);
    const [lastResult, setLastResult] = useState(null);

    const diceTypes = [4, 6, 8, 10, 12, 20, 100];

    const parseAndRoll = useCallback((str) => {
        if (!str) return;

        const cleanStr = str.toLowerCase().replace(/\s+/g, '');
        const parts = cleanStr.split('+');
        let total = 0;
        const details = [];
        const formulaParts = [];

        parts.forEach(part => {
            const dieMatch = part.match(/^(\d+)?d(\d+)$/);
            if (dieMatch) {
                const count = parseInt(dieMatch[1]) || 1;
                const sides = parseInt(dieMatch[2]);
                let dieTotal = 0;
                for (let i = 0; i < count; i++) {
                    const roll = Math.floor(Math.random() * sides) + 1;
                    dieTotal += roll;
                    details.push({ val: roll, max: sides });
                }
                total += dieTotal;
                formulaParts.push(`${count > 1 ? count : ''}d${sides}`);
            } else {
                const num = parseInt(part);
                if (!isNaN(num)) {
                    total += num;
                    details.push({ val: num, max: null });
                    formulaParts.push(num);
                }
            }
        });

        const entry = {
            id: Date.now(),
            formula: formulaParts.join(' + '),
            breakdown: details,
            total: total
        };

        setLastResult(entry);
        setHistory(prev => [entry, ...prev].slice(0, 10));
        setIsOpen(true);
    }, []);

    useEffect(() => {
        const handleRollDiceEvent = (event) => {
            if (event.detail) {
                parseAndRoll(event.detail);
            }
        };

        window.addEventListener('rollDice', handleRollDiceEvent);
        return () => {
            window.removeEventListener('rollDice', handleRollDiceEvent);
        };
    }, [parseAndRoll]);

    const addToFormula = (type, value) => {
        if (type === 'die') {
            if (lastResult) {
                setLastResult(null); // Очищуємо попередній результат
                setFormula([]); // Очищуємо формулу
                setModifier(0); // Очищуємо модифікатор
            }
            setFormula(prev => [...prev, { type, value }]);
        }
    };

    const clearFormula = () => {
        setFormula([]);
        setModifier(0);
    };

    const executeRoll = () => {
        if (formula.length === 0 && modifier === 0) return;

        let total = 0;
        const details = [];
        const diceCounts = {};

        formula.forEach(item => {
            diceCounts[item.value] = (diceCounts[item.value] || 0) + 1;
            const roll = Math.floor(Math.random() * item.value) + 1;
            total += roll;
            details.push({ val: roll, max: item.value });
        });

        const formulaParts = Object.entries(diceCounts).map(([sides, count]) =>
            `${count > 1 ? count : ''}d${sides}`
        );

        if (modifier !== 0) {
            total += parseInt(modifier);
            details.push({ val: parseInt(modifier), max: null });
            formulaParts.push(modifier);
        }

        const rollEntry = {
            id: Date.now(),
            formula: formulaParts.join(' + '),
            breakdown: details,
            total: total
        };

        setLastResult(rollEntry);
        setHistory(prev => [rollEntry, ...prev].slice(0, 10)); // Тримаємо останні 10 кидків
    };

    const clearHistory = () => {
        setHistory([]);
        setLastResult(null);
    };

    const currentFormulaString = formula.length > 0
        ? formula.map(i => i.type === 'die' ? `d${i.value}` : i.value).join(' + ')
        : 'Кидок...';

    const renderBreakdown = (breakdown) => {
        if (!Array.isArray(breakdown)) return breakdown;
        return breakdown.map((item, idx) => {
            const isMin = item.max && item.val === 1;
            const isMax = item.max && item.val === item.max;
            const className = isMin ? 'dice-min' : isMax ? 'dice-max' : '';
            
            return (
                <React.Fragment key={idx}>
                    <span className={className}>{item.val}</span>
                    {idx < breakdown.length - 1 ? ' + ' : ''}
                </React.Fragment>
            );
        });
    };

    const displayFormula = formula.length > 0 || modifier !== 0
        ? (() => {
            const diceCounts = {};
            formula.forEach(i => diceCounts[i.value] = (diceCounts[i.value] || 0) + 1);
            const parts = Object.entries(diceCounts).map(([sides, count]) => `${count > 1 ? count : ''}d${sides}`);
            if (modifier !== 0) parts.push(modifier);
            return parts.join(' + ');
        })()
        : '';

    return (
        <div className={`DiceCalculator ${isOpen ? 'is-open' : ''}`}>
            {isOpen && (
                <div className="DiceCalculator__panel">
                    <div className="DiceCalculator__header">
                        <span>Dice Roller</span>
                        <Button variant="ghost" size="small" icon="x" onClick={() => setIsOpen(false)} />
                    </div>

                    <div className="DiceCalculator__display">
                        {lastResult ? (
                            <div className="DiceCalculator__lastResult">
                                <div className="DiceCalculator__formulaLabel">
                                    {lastResult.formula} ({renderBreakdown(lastResult.breakdown)})
                                </div>
                                <div className="DiceCalculator__totalValue">{lastResult.total}</div>
                            </div>
                        ) : (
                            <div className="DiceCalculator__placeholder">Очікування...</div>
                        )}
                    </div>

                    <div className="DiceCalculator__currentFormula">
                        {displayFormula}
                    </div>

                    <div className="DiceCalculator__controls">
                        <div className="DiceCalculator__group">
                            {diceTypes.map(sides => (
                                <Button
                                    key={sides}
                                    variant="ghost"
                                    size="small"
                                    onClick={() => addToFormula('die', sides)}
                                >
                                    d{sides}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="DiceCalculator__modifier">
                        <label>Бонус:</label>
                        <Input
                            type="number"
                            value={modifier}
                            onChange={(e) => setModifier(parseInt(e.target.value) || 0)}
                        />
                    </div>

                    <div className="DiceCalculator__actions">
                        <Button variant="danger" size="small" onClick={clearFormula}>Clear</Button>
                        <Button
                            variant="primary"
                            className="DiceCalculator__rollBtn"
                            onClick={executeRoll}
                            disabled={formula.length === 0}
                        >
                            ROLL
                        </Button>
                    </div>

                    {history.length > 0 && (
                        <div className="DiceCalculator__history">
                            <div className="DiceCalculator__historyHeader">
                                <span>Історія</span>
                                <button onClick={clearHistory} className="DiceCalculator__clearHistoryBtn">Очистити</button>
                            </div>
                            <div className="DiceCalculator__historyList">
                                {history.map(roll => (
                                    <div
                                        key={roll.id}
                                        className="DiceCalculator__historyItem"
                                        onClick={() => parseAndRoll(roll.formula)}
                                        title="Натисніть, щоб перекинути"
                                    >
                                        <div className="DiceCalculator__historyInfo">
                                            <span><strong>{roll.formula} = {roll.total}</strong></span>
                                            <span className="muted">({renderBreakdown(roll.breakdown)})</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            <button className="DiceCalculator__toggle" onClick={() => setIsOpen(!isOpen)} title="Калькулятор кубиків">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <path d="M7.5 7.5h.01" strokeWidth="4" />
                    <path d="M16.5 16.5h.01" strokeWidth="4" />
                    <path d="M7.5 16.5h.01" strokeWidth="4" />
                    <path d="M16.5 7.5h.01" strokeWidth="4" />
                    <path d="M12 12h.01" strokeWidth="4" />
                </svg>
            </button>
        </div>
    );
}
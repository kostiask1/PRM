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
    const [manualInput, setManualInput] = useState('');

    const diceTypes = [4, 6, 8, 10, 12, 20, 100];

    const parseAndRoll = useCallback((str) => {
        if (!str) return;

        const cleanStr = str.toLowerCase().replace(/\s+/g, '');
        // Підтримка віднімання та від'ємних модифікаторів
        const normalizedStr = cleanStr.replace(/-/g, '+-');
        const parts = normalizedStr.split('+').filter(Boolean);

        let diceTotal = 0;
        let modifierSum = 0;
        let averageTotal = 0;
        const details = [];
        const diceMap = {}; // Об'єкт для групування кубиків за кількістю граней

        let d20Count = 0;
        let lastD20Value = 0;

        parts.forEach(part => {
            const dieMatch = part.match(/^(\d+)?d(\d+)$/);
            if (dieMatch) {
                const count = parseInt(dieMatch[1]) || 1;
                const sides = parseInt(dieMatch[2]);
                
                let dieTotal = 0;
                // Додаємо до групи
                diceMap[sides] = (diceMap[sides] || 0) + count;

                for (let i = 0; i < count; i++) {
                    const roll = Math.floor(Math.random() * sides) + 1;
                    dieTotal += roll;
                    averageTotal += (sides + 1) / 2;
                    details.push({ val: roll, max: sides });

                    if (sides === 20) {
                        d20Count++;
                        lastD20Value = roll;
                    }
                }
                diceTotal += dieTotal;
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
        Object.entries(diceMap)
            .sort((a, b) => b[0] - a[0])
            .forEach(([sides, count]) => {
                formulaParts.push(`${count}d${sides}`);
            });

        if (modifierSum !== 0) {
            formulaParts.push(modifierSum);
        }

        // Правило критичного результату для 1d20
        const isCritical = d20Count === 1 && (lastD20Value === 1 || lastD20Value === 20);
        const finalTotal = isCritical ? lastD20Value : (diceTotal + modifierSum);

        const entry = {
            id: Date.now(),
            formula: formulaParts.join(' + ').replace(/\+\s-/g, '- '),
            breakdown: details,
            total: finalTotal,
            average: Math.floor(averageTotal),
            isCritical: isCritical
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
            if (lastResult) { // Якщо був попередній кидок, очищуємо все для нової формули
                setLastResult(null);
                setManualInput('');
                setModifier(0);
            }
            setManualInput(prev => {
                const currentInput = prev.trim();
                const dieRegex = new RegExp(`(?:(\\d+))?d${value}(\\b)`, 'i');
                const match = currentInput.match(dieRegex);

                if (match) {
                    const currentCount = parseInt(match[1] || '1');
                    return currentInput.replace(dieRegex, `${currentCount + 1}d${value}`);
                } else {
                    const dieStr = `1d${value}`;
                    if (currentInput === '' || /[+\-*/]$/.test(currentInput)) {
                        return `${currentInput}${dieStr}`;
                    }
                    return `${currentInput}+${dieStr}`;
                }
            });
        }
    };

    const clearFormula = () => {
        setManualInput('');
        setModifier(0);
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
            const className = isMin ? 'dice-min' : isMax ? 'dice-max' : '';
            const sign = idx > 0 && item.val >= 0 ? ' + ' : '';
            return (
                <React.Fragment key={idx}>
                    {sign}<span className={className}>{item.val}</span>
                </React.Fragment>
            );
        });

        if (hasMore) {
            content.push(<span key="more" className="muted"> + ...</span>);
        }

        return content;
    }, []);

    const getFullBreakdownString = useCallback((breakdown) => {
        if (!Array.isArray(breakdown)) return "";
        return breakdown.map((item, idx) => {
            const isNegative = item.val < 0;
            const sign = idx > 0 ? (isNegative ? ' - ' : ' + ') : (isNegative ? '-' : '');
            const valueToShow = Math.abs(item.val);
            return `${sign}${valueToShow}`;
        }).join('');
    }, []);

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
                                <div 
                                    className="DiceCalculator__formulaLabel"
                                    title={`${lastResult.formula} (${getFullBreakdownString(lastResult.breakdown)})`}
                                >
                                    {lastResult.formula} ({renderBreakdown(lastResult.breakdown)})
                                </div>
                                <div className="DiceCalculator__totalValue-container">
                                    <span 
                                        className={`DiceCalculator__totalValue ${lastResult.isCritical ? (lastResult.total === 20 ? 'dice-max' : 'dice-min') : ''}`}
                                    >
                                        {lastResult.total}
                                    </span>
                                    {lastResult.average !== undefined && (
                                        <span className="DiceCalculator__averageValue">({lastResult.average})</span>
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
                                if (e.key === 'Enter' && manualInput.trim()) {
                                    parseAndRoll(manualInput);
                                }
                            }}
                        />
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
                    <div className="DiceCalculator__actions">
                        <Button variant="danger" size="small" onClick={clearFormula}>Clear</Button>
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
                                        <div 
                                            className="DiceCalculator__historyInfo"
                                            title={`${roll.formula} = ${roll.total} (${getFullBreakdownString(roll.breakdown)})`}
                                        >
                                                <span>
                                                    <strong>
                                                        {roll.formula} = 
                                                        <span className={roll.isCritical ? (roll.total === 20 ? 'dice-max' : 'dice-min') : ''}> {roll.total}</span>
                                                    </strong>
                                                </span>
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
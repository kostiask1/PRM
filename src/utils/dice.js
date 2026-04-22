function normalizeFormula(input = "") {
	return String(input || "")
		.toLowerCase()
		.replace(/\s+/g, "");
}

export function rollDiceFormula(input) {
	const cleanStr = normalizeFormula(input);
	if (!cleanStr) return null;

	const normalizedStr = cleanStr.replace(/-/g, "+-");
	const parts = normalizedStr.split("+").filter(Boolean);

	let diceTotal = 0;
	let modifierSum = 0;
	let averageTotal = 0;
	const details = [];
	const diceMap = {};

	let d20Count = 0;
	let lastD20Value = 0;

	for (const part of parts) {
		const dieMatch = part.match(/^(\d+)?d(\d+)([hl]\d+)?$/i);
		if (dieMatch) {
			const count = parseInt(dieMatch[1], 10) || 1;
			const sides = parseInt(dieMatch[2], 10);
			const keepSuffix = dieMatch[3];

			const groupKey = `${sides}${keepSuffix || ""}`;
			diceMap[groupKey] = (diceMap[groupKey] || 0) + count;

			const currentRolls = [];
			for (let i = 0; i < count; i += 1) {
				const roll = Math.floor(Math.random() * sides) + 1;
				currentRolls.push({ val: roll, max: sides });

				if (sides === 20 && !keepSuffix) {
					d20Count += 1;
					lastD20Value = roll;
				}
			}

			if (keepSuffix) {
				const type = keepSuffix[0].toLowerCase();
				const keepCount = Math.min(parseInt(keepSuffix.slice(1), 10), count);
				const indexed = currentRolls.map((r, idx) => ({ val: r.val, idx }));
				indexed.sort((a, b) => (type === "h" ? b.val - a.val : a.val - b.val));
				const keptIndices = new Set(indexed.slice(0, keepCount).map((r) => r.idx));

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
			continue;
		}

		const num = parseInt(part, 10);
		if (!Number.isNaN(num)) {
			modifierSum += num;
			averageTotal += num;
			details.push({ val: num, max: null });
		}
	}

	const formulaParts = [];
	Object.keys(diceMap)
		.sort((a, b) => parseInt(b, 10) - parseInt(a, 10))
		.forEach((key) => {
			formulaParts.push(`${diceMap[key]}d${key}`);
		});

	if (modifierSum !== 0) {
		formulaParts.push(modifierSum);
	}

	const isCritical = d20Count === 1 && (lastD20Value === 1 || lastD20Value === 20);
	const finalTotal = isCritical ? lastD20Value : diceTotal + modifierSum;

	return {
		id: Date.now(),
		formula: formulaParts.join(" + ").replace(/\+\s-/g, "- "),
		breakdown: details,
		total: finalTotal,
		average: Math.floor(averageTotal),
		isCritical,
	};
}

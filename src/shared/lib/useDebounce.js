import { useEffect, useState } from "react";

export default function useDebounce(value, delay = 250) {
	const [debouncedValue, setDebouncedValue] = useState(value);

	useEffect(() => {
		if (delay <= 0) {
			setDebouncedValue(value);
			return undefined;
		}

		const timeoutId = setTimeout(() => {
			setDebouncedValue(value);
		}, delay);

		return () => clearTimeout(timeoutId);
	}, [delay, value]);

	return debouncedValue;
}

export function isJSON(str) {
    try {
        const o = JSON.parse(str);

        // Handle non-exception-throwing cases:
        // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
        // but... JSON.parse(null) returns null, and typeof null === "object", 
        // so we must check for that, too. Thankfully, null is falsey, so this suffices:
        if (o && typeof o === "object") {
            return true;
        }
    }
    catch (e) { }

    return false;
}

export function isJsonString(str) {
    try {
        const result = JSON.parse(str);

        if (typeof result === "string") {
            return true
        }
    } catch (e) {
    }
    return false;
}
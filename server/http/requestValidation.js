class RequestValidationError extends Error {
	constructor(issues, message = "Invalid request payload.") {
		super(message);
		this.name = "RequestValidationError";
		this.status = 400;
		this.code = "INVALID_REQUEST";
		this.details = Array.isArray(issues) ? issues : [];
	}
}

function validationIssue(path, message, code = "invalid_value") {
	return {
		path: String(path || "body"),
		message: String(message || "Invalid value."),
		code,
	};
}

function createRequestValidationError(issues, message) {
	return new RequestValidationError(issues, message);
}

function assertValidRequest(value, validator, path = "body") {
	const issues = validator(value, path);
	if (issues.length > 0) {
		throw createRequestValidationError(issues);
	}
	return value;
}

function validateBody(validator) {
	return (req, _res, next) => {
		try {
			req.validatedBody = assertValidRequest(
				req.body,
				validator,
				"body",
			);
			next();
		} catch (error) {
			next(error);
		}
	};
}

module.exports = {
	RequestValidationError,
	assertValidRequest,
	createRequestValidationError,
	validateBody,
	validationIssue,
};

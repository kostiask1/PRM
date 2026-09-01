import type {
	AiContractValidationOptions,
	AiContractValidationResult,
} from "./aiPayloadContracts.ts";

export function validateAiGeneratedContent(
	payload: unknown,
	options?: AiContractValidationOptions,
): AiContractValidationResult;

export function assertAiGeneratedContentContract(
	payload: unknown,
	options?: AiContractValidationOptions,
): AiContractValidationResult;

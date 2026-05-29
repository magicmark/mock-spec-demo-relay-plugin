import type { RequestParameters } from "relay-runtime";
import type { MockRegistry, MockDirectiveArgs } from "./types.js";

export function resolveFieldMock(
  directive: { args: MockDirectiveArgs; fragmentName?: string; fieldName: string },
  request: RequestParameters,
  mockRegistry: MockRegistry
): { data: unknown; errors?: Array<unknown> } {
  const { args, fragmentName } = directive;

  if (args.value !== undefined) {
    return { data: coerceInlineValue(args.value) };
  }

  if (!args.variant) {
    return { data: null };
  }

  const lookupName = fragmentName || request.name;
  const mockFile = mockRegistry[lookupName];
  if (!mockFile) {
    console.warn(`[relay-mock] No mock file found for "${lookupName}"`);
    return { data: null };
  }

  const mockVariant = mockFile[args.variant];
  if (!mockVariant) {
    console.warn(`[relay-mock] No variant "${args.variant}" in mock file for "${lookupName}"`);
    return { data: null };
  }

  return { data: mockVariant.data, errors: mockVariant.errors };
}

export function coerceInlineValue(value: string): unknown {
  if (value === "null") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  const num = Number(value);
  if (!isNaN(num) && value.trim() !== "") return num;
  return value;
}

import type { RequestParameters } from "relay-runtime";
import type { MockRegistry } from "./types.js";
import type { ParsedMockDirective } from "./transform.js";
import { resolveFieldMock } from "./resolve.js";

export function mergeMockData(
  serverResponse: Record<string, unknown>,
  mockDirectives: ParsedMockDirective[],
  request: RequestParameters,
  mockRegistry: MockRegistry
): Record<string, unknown> {
  const data = (serverResponse.data as Record<string, unknown>) || {};
  const errors: Array<unknown> = (serverResponse.errors as Array<unknown>) || [];

  for (const directive of mockDirectives) {
    if (directive.isOperation) continue;

    const resolved = resolveFieldMock(directive, request, mockRegistry);
    injectMockValue(data, directive.path, directive.alias || directive.fieldName, resolved.data);

    if (resolved.errors) {
      errors.push(...resolved.errors);
    }
  }

  const result: Record<string, unknown> = { data };
  if (errors.length > 0) {
    result.errors = errors;
  }
  if (serverResponse.extensions) {
    result.extensions = serverResponse.extensions;
  }

  return result;
}

function injectMockValue(
  data: Record<string, unknown>,
  path: string,
  fieldName: string,
  value: unknown
): void {
  if (!path) {
    data[fieldName] = value;
    return;
  }

  const parts = path.split(".");
  let current: unknown = data;

  for (let i = 0; i < parts.length; i++) {
    if (current === null || current === undefined) return;

    if (Array.isArray(current)) {
      const remainingPath = parts.slice(i).join(".");
      for (const item of current) {
        if (item && typeof item === "object") {
          injectMockValue(item as Record<string, unknown>, remainingPath, fieldName, value);
        }
      }
      return;
    }

    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[parts[i]];
    } else {
      return;
    }
  }

  if (current === null || current === undefined) return;

  if (Array.isArray(current)) {
    for (const item of current) {
      if (item && typeof item === "object") {
        (item as Record<string, unknown>)[fieldName] = value;
      }
    }
  } else if (typeof current === "object") {
    (current as Record<string, unknown>)[fieldName] = value;
  }
}

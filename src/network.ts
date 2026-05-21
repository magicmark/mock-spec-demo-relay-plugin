import type {
  FetchFunction,
  RequestParameters,
  Variables,
} from "relay-runtime";
import type { MockRegistry, MockDirectiveArgs } from "./types.js";
import { parseMockDirectives, stripMockedFields } from "./transform.js";
import { mergeMockData } from "./merge.js";

export interface CreateMockNetworkOptions {
  mockRegistry: MockRegistry;
  fetch: FetchFunction;
}

export function createMockNetwork(options: CreateMockNetworkOptions): FetchFunction {
  const { mockRegistry, fetch: innerFetch } = options;

  return (request: RequestParameters, variables: Variables, cacheConfig, uploadables) => {
    const queryText = request.text;
    if (!queryText) {
      return innerFetch(request, variables, cacheConfig, uploadables);
    }

    const mockDirectives = parseMockDirectives(queryText);

    if (mockDirectives.length === 0) {
      return innerFetch(request, variables, cacheConfig, uploadables);
    }

    const operationMock = mockDirectives.find((d) => d.isOperation);
    if (operationMock) {
      return resolveOperationMock(operationMock, request, mockRegistry) as ReturnType<FetchFunction>;
    }

    const strippedQuery = stripMockedFields(queryText);

    if (strippedQuery === null) {
      const response = buildMockOnlyResponse(mockDirectives, request, mockRegistry);
      return Promise.resolve(response) as unknown as ReturnType<FetchFunction>;
    }

    const modifiedRequest: RequestParameters = {
      ...request,
      text: strippedQuery,
    };

    const result = innerFetch(modifiedRequest, variables, cacheConfig, uploadables);

    if (result && typeof result === "object" && "then" in result) {
      return (result as Promise<unknown>).then((serverResponse) =>
        mergeMockData(serverResponse as Record<string, unknown>, mockDirectives, request, mockRegistry)
      ) as unknown as ReturnType<FetchFunction>;
    }

    return result;
  };
}

function resolveOperationMock(
  directive: { args: MockDirectiveArgs },
  request: RequestParameters,
  mockRegistry: MockRegistry
): Promise<unknown> {
  const { variant } = directive.args;
  if (!variant) {
    return Promise.resolve({ data: {} });
  }

  const operationName = request.name;
  const mockFile = mockRegistry[operationName];
  if (!mockFile) {
    console.warn(`[relay-mock] No mock file found for operation "${operationName}"`);
    return Promise.resolve({ data: {} });
  }

  const mockVariant = mockFile[variant];
  if (!mockVariant) {
    console.warn(`[relay-mock] No variant "${variant}" in mock file for "${operationName}"`);
    return Promise.resolve({ data: {} });
  }

  const response: Record<string, unknown> = { data: mockVariant.data };
  if (mockVariant.errors) {
    response.errors = mockVariant.errors;
  }
  if (mockVariant.extensions) {
    response.extensions = mockVariant.extensions;
  }

  return Promise.resolve(response);
}

function buildMockOnlyResponse(
  mockDirectives: Array<{ path: string; fieldName: string; alias?: string; args: MockDirectiveArgs; fragmentName?: string }>,
  request: RequestParameters,
  mockRegistry: MockRegistry
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const errors: Array<unknown> = [];

  for (const directive of mockDirectives) {
    const resolved = resolveFieldMock(directive, request, mockRegistry);
    setNestedValue(data, directive.path, directive.alias || directive.fieldName, resolved.data);
    if (resolved.errors) {
      errors.push(...resolved.errors);
    }
  }

  const response: Record<string, unknown> = { data };
  if (errors.length > 0) {
    response.errors = errors;
  }
  return response;
}

function resolveFieldMock(
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

function coerceInlineValue(value: string): unknown {
  if (value === "null") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  const num = Number(value);
  if (!isNaN(num) && value.trim() !== "") return num;
  return value;
}

function setNestedValue(obj: Record<string, unknown>, path: string, fieldName: string, value: unknown): void {
  const parts = path.split(".").filter(Boolean);
  let current: Record<string, unknown> = obj;

  for (const part of parts) {
    if (!(part in current) || typeof current[part] !== "object" || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[fieldName] = value;
}

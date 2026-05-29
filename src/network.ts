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
      const response = mergeMockData({ data: {} }, mockDirectives, request, mockRegistry);
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

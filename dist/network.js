import { parseMockDirectives, stripMockedFields } from "./transform.js";
import { mergeMockData } from "./merge.js";
export function createMockNetwork(options) {
    const { mockRegistry, fetch: innerFetch } = options;
    return (request, variables, cacheConfig, uploadables) => {
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
            return resolveOperationMock(operationMock, request, mockRegistry);
        }
        const strippedQuery = stripMockedFields(queryText);
        if (strippedQuery === null) {
            const response = mergeMockData({ data: {} }, mockDirectives, request, mockRegistry);
            return Promise.resolve(response);
        }
        const modifiedRequest = {
            ...request,
            text: strippedQuery,
        };
        const result = innerFetch(modifiedRequest, variables, cacheConfig, uploadables);
        if (result && typeof result === "object" && "then" in result) {
            return result.then((serverResponse) => mergeMockData(serverResponse, mockDirectives, request, mockRegistry));
        }
        return result;
    };
}
function resolveOperationMock(directive, request, mockRegistry) {
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
    const response = { data: mockVariant.data };
    if (mockVariant.errors) {
        response.errors = mockVariant.errors;
    }
    if (mockVariant.extensions) {
        response.extensions = mockVariant.extensions;
    }
    return Promise.resolve(response);
}

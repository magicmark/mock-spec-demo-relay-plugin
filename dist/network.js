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
            const response = buildMockOnlyResponse(mockDirectives, request, mockRegistry);
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
function buildMockOnlyResponse(mockDirectives, request, mockRegistry) {
    const data = {};
    const errors = [];
    for (const directive of mockDirectives) {
        const resolved = resolveFieldMock(directive, request, mockRegistry);
        setNestedValue(data, directive.path, directive.alias || directive.fieldName, resolved.data);
        if (resolved.errors) {
            errors.push(...resolved.errors);
        }
    }
    const response = { data };
    if (errors.length > 0) {
        response.errors = errors;
    }
    return response;
}
function resolveFieldMock(directive, request, mockRegistry) {
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
function coerceInlineValue(value) {
    if (value === "null")
        return null;
    if (value === "true")
        return true;
    if (value === "false")
        return false;
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== "")
        return num;
    return value;
}
function setNestedValue(obj, path, fieldName, value) {
    const parts = path.split(".").filter(Boolean);
    let current = obj;
    for (const part of parts) {
        if (!(part in current) || typeof current[part] !== "object" || current[part] === null) {
            current[part] = {};
        }
        current = current[part];
    }
    current[fieldName] = value;
}

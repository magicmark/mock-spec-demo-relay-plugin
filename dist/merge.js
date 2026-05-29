import { resolveFieldMock } from "./resolve.js";
export function mergeMockData(serverResponse, mockDirectives, request, mockRegistry) {
    const data = serverResponse.data || {};
    const errors = serverResponse.errors || [];
    for (const directive of mockDirectives) {
        if (directive.isOperation)
            continue;
        const resolved = resolveFieldMock(directive, request, mockRegistry);
        injectMockValue(data, directive.path, directive.alias || directive.fieldName, resolved.data);
        if (resolved.errors) {
            errors.push(...resolved.errors);
        }
    }
    const result = { data };
    if (errors.length > 0) {
        result.errors = errors;
    }
    if (serverResponse.extensions) {
        result.extensions = serverResponse.extensions;
    }
    return result;
}
function injectMockValue(data, path, fieldName, value) {
    if (!path) {
        data[fieldName] = value;
        return;
    }
    const parts = path.split(".");
    let current = data;
    for (let i = 0; i < parts.length; i++) {
        if (current === null || current === undefined)
            return;
        if (Array.isArray(current)) {
            const remainingPath = parts.slice(i).join(".");
            for (const item of current) {
                if (item && typeof item === "object") {
                    injectMockValue(item, remainingPath, fieldName, value);
                }
            }
            return;
        }
        if (typeof current === "object") {
            current = current[parts[i]];
        }
        else {
            return;
        }
    }
    if (current === null || current === undefined)
        return;
    if (Array.isArray(current)) {
        for (const item of current) {
            if (item && typeof item === "object") {
                item[fieldName] = value;
            }
        }
    }
    else if (typeof current === "object") {
        current[fieldName] = value;
    }
}

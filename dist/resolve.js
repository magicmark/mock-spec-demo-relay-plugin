export function resolveFieldMock(directive, request, mockRegistry) {
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
export function coerceInlineValue(value) {
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

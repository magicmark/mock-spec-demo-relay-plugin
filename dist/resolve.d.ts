import type { RequestParameters } from "relay-runtime";
import type { MockRegistry, MockDirectiveArgs } from "./types.js";
export declare function resolveFieldMock(directive: {
    args: MockDirectiveArgs;
    fragmentName?: string;
    fieldName: string;
}, request: RequestParameters, mockRegistry: MockRegistry): {
    data: unknown;
    errors?: Array<unknown>;
};
export declare function coerceInlineValue(value: string): unknown;

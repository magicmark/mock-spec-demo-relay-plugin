import type { MockDirectiveArgs } from "./types.js";
export interface ParsedMockDirective {
    fieldName: string;
    alias?: string;
    path: string;
    args: MockDirectiveArgs;
    isOperation: boolean;
    fragmentName?: string;
}
export declare function parseMockDirectives(queryText: string): ParsedMockDirective[];
export declare function stripMockedFields(queryText: string): string | null;

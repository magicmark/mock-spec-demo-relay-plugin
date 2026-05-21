import type { RequestParameters } from "relay-runtime";
import type { MockRegistry } from "./types.js";
import type { ParsedMockDirective } from "./transform.js";
export declare function mergeMockData(serverResponse: Record<string, unknown>, mockDirectives: ParsedMockDirective[], request: RequestParameters, mockRegistry: MockRegistry): Record<string, unknown>;

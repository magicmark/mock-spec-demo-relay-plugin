import type { FetchFunction } from "relay-runtime";
import type { MockRegistry } from "./types.js";
export interface CreateMockNetworkOptions {
    mockRegistry: MockRegistry;
    fetch: FetchFunction;
}
export declare function createMockNetwork(options: CreateMockNetworkOptions): FetchFunction;

export interface MockVariant {
  data: unknown;
  __path__: string;
  __description__?: string;
  __metadata__?: unknown;
  errors?: Array<{
    message: string;
    path?: Array<string | number>;
    extensions?: Record<string, unknown>;
  }>;
  extensions?: Record<string, unknown>;
}

export type MockFile = Record<string, MockVariant>;

export type MockRegistry = Record<string, MockFile>;

export interface MockDirectiveArgs {
  variant?: string;
  value?: string;
}

export interface MockNetworkOptions {
  mockRegistry: MockRegistry;
  fetchFn: (request: unknown, variables: unknown) => Promise<unknown>;
}

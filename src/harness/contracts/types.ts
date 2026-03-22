export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | ReadonlyArray<JsonValue> | { [key: string]: JsonValue };

export type ContractFixture<TPayload extends JsonValue = JsonValue> = {
  name: string;
  version: string;
  providerState: string;
  requiredPaths: string[];
  notes?: string[];
  payload: TPayload;
};

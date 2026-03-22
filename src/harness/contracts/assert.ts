import type { ContractFixture, JsonValue } from "./types.js";

function readPath(root: JsonValue, pathExpr: string): JsonValue | undefined {
  let current: JsonValue | undefined = root;
  for (const segment of pathExpr.split(".")) {
    if (Array.isArray(current)) {
      const index = Number.parseInt(segment, 10);
      if (!Number.isFinite(index)) {
        return undefined;
      }
      current = current[index];
      continue;
    }
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, JsonValue>)[segment];
  }
  return current;
}

export function verifyContractFixture<TPayload extends JsonValue>(
  actual: JsonValue,
  fixture: ContractFixture<TPayload>,
): void {
  for (const pathExpr of fixture.requiredPaths) {
    const expectedValue = readPath(fixture.payload, pathExpr);
    const actualValue = readPath(actual, pathExpr);
    if (actualValue === undefined) {
      throw new Error(`Missing required contract path "${pathExpr}" for ${fixture.name}.`);
    }
    if (JSON.stringify(expectedValue) !== JSON.stringify(actualValue)) {
      throw new Error(
        `Contract mismatch at "${pathExpr}" for ${fixture.name}.\n` +
          `Expected: ${JSON.stringify(expectedValue)}\n` +
          `Actual: ${JSON.stringify(actualValue)}`,
      );
    }
  }
}

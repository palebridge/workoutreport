import assert from "node:assert/strict";
import test from "node:test";
import { readPreference, writePreference } from "../src/hooks/storage";

test("blocked storage getter and quota failures do not prevent preference use", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("Storage denied");
      },
    });
    assert.equal(readPreference("wr.unit"), null);
    assert.doesNotThrow(() => writePreference("wr.unit", "lb"));
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: () => "lb",
        setItem: () => {
          throw new Error("Quota exceeded");
        },
      },
    });
    assert.equal(readPreference("wr.unit"), "lb");
    assert.doesNotThrow(() => writePreference("wr.unit", "kg"));
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

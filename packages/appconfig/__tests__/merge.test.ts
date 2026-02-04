import { describe, it, expect } from "vitest";
import { deepMerge } from "../src/merge.js";

describe("deepMerge", () => {
  describe("primitive values", () => {
    it("overwrites primitive values", () => {
      const result = deepMerge({ a: 1 }, { a: 2 });
      expect(result.a).toBe(2);
    });

    it("adds new keys from source", () => {
      const result = deepMerge({ a: 1 }, { b: 2 });
      expect(result).toEqual({ a: 1, b: 2 });
    });

    it("handles string values", () => {
      const result = deepMerge({ name: "old" }, { name: "new" });
      expect(result.name).toBe("new");
    });

    it("handles boolean values", () => {
      const result = deepMerge({ enabled: false }, { enabled: true });
      expect(result.enabled).toBe(true);
    });

    it("handles null values", () => {
      const result = deepMerge({ a: 1 }, { a: null });
      expect(result.a).toBeNull();
    });

    it("handles undefined values", () => {
      const result = deepMerge({ a: 1 }, { a: undefined });
      expect(result.a).toBeUndefined();
    });
  });

  describe("nested objects", () => {
    it("deep merges nested objects", () => {
      const result = deepMerge(
        { api: { timeout: 5000, retries: 3 } },
        { api: { timeout: 10000 } },
      );
      expect(result).toEqual({
        api: { timeout: 10000, retries: 3 },
      });
    });

    it("handles deeply nested objects", () => {
      const result = deepMerge(
        { a: { b: { c: { d: 1, e: 2 } } } },
        { a: { b: { c: { d: 10 } } } },
      );
      expect(result).toEqual({
        a: { b: { c: { d: 10, e: 2 } } },
      });
    });

    it("adds new nested keys", () => {
      const result = deepMerge(
        { api: { timeout: 5000 } },
        { api: { retries: 3 } },
      );
      expect(result).toEqual({
        api: { timeout: 5000, retries: 3 },
      });
    });

    it("adds new nested objects", () => {
      const result = deepMerge(
        { api: { timeout: 5000 } },
        { features: { darkMode: true } },
      );
      expect(result).toEqual({
        api: { timeout: 5000 },
        features: { darkMode: true },
      });
    });
  });

  describe("arrays", () => {
    it("replaces arrays entirely (no merging)", () => {
      const result = deepMerge({ tags: [1, 2, 3] }, { tags: [4, 5] });
      expect(result.tags).toEqual([4, 5]);
    });

    it("handles arrays in nested objects", () => {
      const result = deepMerge(
        { api: { endpoints: ["/a", "/b"], timeout: 5000 } },
        { api: { endpoints: ["/c"] } },
      );
      expect(result).toEqual({
        api: { endpoints: ["/c"], timeout: 5000 },
      });
    });
  });

  describe("multiple sources", () => {
    it("merges multiple sources in order", () => {
      const result = deepMerge({ a: 1, b: 2 }, { b: 3, c: 4 }, { c: 5, d: 6 });
      expect(result).toEqual({ a: 1, b: 3, c: 5, d: 6 });
    });

    it("deep merges multiple nested sources", () => {
      const result = deepMerge(
        { api: { a: 1, b: 2 } },
        { api: { b: 3, c: 4 } },
        { api: { c: 5, d: 6 } },
      );
      expect(result).toEqual({
        api: { a: 1, b: 3, c: 5, d: 6 },
      });
    });

    it("skips null/undefined sources", () => {
      const result = deepMerge(
        { a: 1 },
        null as unknown as Record<string, unknown>,
        { b: 2 },
      );
      expect(result).toEqual({ a: 1, b: 2 });
    });
  });

  describe("immutability", () => {
    it("does not mutate the target object", () => {
      const target = { a: 1, nested: { b: 2 } };
      const source = { a: 10, nested: { c: 3 } };
      const result = deepMerge(target, source);

      expect(target).toEqual({ a: 1, nested: { b: 2 } });
      expect(result).toEqual({ a: 10, nested: { b: 2, c: 3 } });
    });

    it("does not mutate the source object", () => {
      const target = { a: 1 };
      const source = { b: 2 };
      deepMerge(target, source);

      expect(source).toEqual({ b: 2 });
    });
  });

  describe("edge cases", () => {
    it("handles empty objects", () => {
      expect(deepMerge({}, {})).toEqual({});
      expect(deepMerge({ a: 1 }, {})).toEqual({ a: 1 });
      expect(deepMerge({}, { a: 1 })).toEqual({ a: 1 });
    });

    it("handles Date objects as primitives (replaced)", () => {
      const date1 = new Date("2024-01-01");
      const date2 = new Date("2024-12-31");
      const result = deepMerge({ date: date1 }, { date: date2 });
      expect(result.date).toBe(date2);
    });

    it("handles class instances as primitives (replaced)", () => {
      class MyClass {
        value: number;
        constructor(v: number) {
          this.value = v;
        }
      }
      const obj1 = new MyClass(1);
      const obj2 = new MyClass(2);
      const result = deepMerge({ obj: obj1 }, { obj: obj2 });
      expect(result.obj).toBe(obj2);
    });
  });
});

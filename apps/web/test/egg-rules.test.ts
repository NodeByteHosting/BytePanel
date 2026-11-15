import { describe, expect, test } from "bun:test";

import { parseRules, validateVariable } from "@/lib/eggs/rules";

describe("parseRules", () => {
  test("parses the common Pterodactyl rule shapes", () => {
    expect(parseRules("required|string|max:20")).toMatchObject({
      max: 20,
      required: true,
      type: "string",
    });
    expect(parseRules("nullable|integer|between:1,100")).toMatchObject({
      max: 100,
      min: 1,
      nullable: true,
      type: "integer",
    });
    expect(parseRules("required|in:vanilla,paper")).toMatchObject({
      options: ["vanilla", "paper"],
    });
  });

  test("keeps pipes inside a regex rule", () => {
    const rules = parseRules("required|regex:/^(latest|[0-9.]+)$/");
    expect(rules.regex?.test("latest")).toBe(true);
    expect(rules.regex?.test("1.21.4")).toBe(true);
    expect(rules.regex?.test("nope")).toBe(false);
  });
});

describe("validateVariable", () => {
  test("required vs nullable empty values", () => {
    expect(validateVariable("", "required|string")).toMatch(/required/u);
    expect(validateVariable("", "nullable|string")).toBeNull();
  });

  test("string length limits", () => {
    expect(validateVariable("abcdef", "required|string|max:5", "Name")).toBe(
      "Name must be at most 5 characters"
    );
    expect(validateVariable("abc", "required|string|min:5")).toMatch(
      /at least 5/u
    );
  });

  test("numeric ranges and types", () => {
    expect(validateVariable("10", "required|integer|between:1,20")).toBeNull();
    expect(validateVariable("21", "required|integer|between:1,20")).toMatch(
      /at most 20/u
    );
    expect(validateVariable("1.5", "required|integer")).toMatch(
      /whole number/u
    );
    expect(validateVariable("1.5", "required|numeric")).toBeNull();
  });

  test("enumerations and booleans", () => {
    expect(validateVariable("paper", "required|in:vanilla,paper")).toBeNull();
    expect(validateVariable("forge", "required|in:vanilla,paper")).toMatch(
      /one of/u
    );
    expect(validateVariable("1", "required|boolean")).toBeNull();
    expect(validateVariable("yes", "required|boolean")).toMatch(
      /true or false/u
    );
  });

  test("alpha_dash and url", () => {
    expect(validateVariable("my-world_1", "required|alpha_dash")).toBeNull();
    expect(validateVariable("my world", "required|alpha_dash")).not.toBeNull();
    expect(
      validateVariable("https://example.com/a.zip", "required|url")
    ).toBeNull();
    expect(validateVariable("not a url", "required|url")).not.toBeNull();
  });
});

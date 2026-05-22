import type {
  FixerStrategy,
  ValidatorRule,
} from "../shared/schemas/templateSchema";

export const checkRule = (
  value: string,
  rule: ValidatorRule,
): string | null => {
  switch (rule.type) {
    case "required":
      return value.trim() === "" ? "Value is required" : null;

    case "minLength":
      return value.length < rule.min
        ? `Minimum length is ${rule.min} characters`
        : null;

    case "maxLength":
      return value.length > rule.max
        ? `Maximum length is ${rule.max} characters`
        : null;

    case "regex":
      return new RegExp(rule.pattern).test(value)
        ? null
        : (rule.message ?? `Must match pattern: ${rule.pattern}`);

    case "numeric": {
      const n = Number(value);

      if (isNaN(n)) {
        return "Must be a number";
      }

      if (rule.min !== undefined && n < rule.min) {
        return `Minimum value is ${rule.min}`;
      }

      if (rule.max !== undefined && n > rule.max) {
        return `Maximum value is ${rule.max}`;
      }

      return null;
    }

    case "integer": {
      const n = Number(value);

      return isNaN(n) || !Number.isInteger(n) ? "Must be a whole number" : null;
    }

    case "date":
      return isNaN(Date.parse(value)) ? "Must be a valid date" : null;

    case "boolean":
      const booleanValues = ["true", "false"];

      return booleanValues.includes(value.toLowerCase())
        ? null
        : `Must be one of: ${booleanValues.join(", ")}`;

    case "enum": {
      const match =
        rule.caseSensitive === false
          ? rule.values.some((v) => v.toLowerCase() === value.toLowerCase())
          : rule.values.includes(value);

      return match ? null : `Must be one of: ${rule.values.join(", ")}`;
    }

    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        ? null
        : "Must be a valid email address";

    case "url":
      try {
        new URL(value);

        return null;
      } catch {
        return "Must be a valid URL";
      }
  }
};

export const applyFixer = (value: string, strategy: FixerStrategy): string => {
  switch (strategy) {
    case "trim":
      return value.trim();
    case "trimAndLower":
      return value.trim().toLowerCase();
    case "trimAndUpper":
      return value.trim().toUpperCase();
    case "normalizeWhitespace":
      return value.trim().replace(/\s+/g, " ");
    case "stripNonNumeric":
      return value.replace(/[^\d.]/g, "");
  }
};

export const runValidators = (
  value: string,
  rules: Array<ValidatorRule>,
): Array<string> =>
  rules.flatMap((rule) => {
    const error = checkRule(value, rule);

    return error ? [error] : [];
  });

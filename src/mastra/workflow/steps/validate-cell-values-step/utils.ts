import type {
  FixerStrategy,
  TemplateColumn,
  ValidatorRule,
} from "../../shared/schemas/templateSchema";

const DATE_FORMAT_PATTERNS: Record<string, RegExp> = {
  "YYYY-MM-DD": /^(?<y>\d{4})-(?<m>0[1-9]|1[0-2])-(?<d>0[1-9]|[12]\d|3[01])$/,
  "MM/DD/YYYY": /^(?<m>0[1-9]|1[0-2])\/(?<d>0[1-9]|[12]\d|3[01])\/(?<y>\d{4})$/,
  "DD/MM/YYYY": /^(?<d>0[1-9]|[12]\d|3[01])\/(?<m>0[1-9]|1[0-2])\/(?<y>\d{4})$/,
  "YYYY-MM-DDTHH:mm:ss":
    /^(?<y>\d{4})-(?<m>0[1-9]|1[0-2])-(?<d>0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/,
};

const ISO_8601_PATTERN =
  /^(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})(?:T(?<h>\d{2}):(?<min>\d{2})(?::(?<s>\d{2})(?:\.\d+)?)?(?:Z|[+-](?<oh>\d{2}):?(?<om>\d{2}))?)?$/;

const isValidCalendarDate = (
  year: number,
  month: number,
  day: number,
): boolean => {
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCFullYear(year);

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const isValidIsoDate = (value: string): boolean => {
  const groups = ISO_8601_PATTERN.exec(value)?.groups;

  if (!groups) {
    return false;
  }

  const { y, m, d, h, min, s, oh, om } = groups;
  const inRange = (raw: string | undefined, max: number): boolean =>
    raw === undefined || Number(raw) <= max;

  return (
    isValidCalendarDate(Number(y), Number(m), Number(d)) &&
    inRange(h, 23) &&
    inRange(min, 59) &&
    inRange(s, 59) &&
    inRange(oh, 23) &&
    inRange(om, 59)
  );
};

const isValidDate = (value: string, format: string | undefined): boolean => {
  const pattern = format ? DATE_FORMAT_PATTERNS[format] : undefined;

  if (!pattern) {
    return isValidIsoDate(value);
  }

  const groups = pattern.exec(value)?.groups;

  return (
    groups !== undefined &&
    isValidCalendarDate(Number(groups.y), Number(groups.m), Number(groups.d))
  );
};

const REGEX_FALLBACK = (pattern: string): RegExp => new RegExp(pattern);

export const checkRule = (
  value: string,
  rule: ValidatorRule,
  compiledRegex?: RegExp,
): string | null => {
  if (rule.type === "required") {
    return value.trim() === "" ? "Value is required" : null;
  }

  if (value.trim() === "") {
    return null;
  }

  switch (rule.type) {
    case "minLength":
      return value.length < rule.min
        ? `Minimum length is ${rule.min} characters`
        : null;

    case "maxLength":
      return value.length > rule.max
        ? `Maximum length is ${rule.max} characters`
        : null;

    case "regex":
      return (compiledRegex ?? REGEX_FALLBACK(rule.pattern)).test(value)
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
      return isValidDate(value, rule.format) ? null : "Must be a valid date";

    case "boolean": {
      const booleanValues = ["true", "false"];

      return booleanValues.includes(value.toLowerCase())
        ? null
        : `Must be one of: ${booleanValues.join(", ")}`;
    }
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
      return value.replace(/[^\d.-]/g, "");
  }
};

export const createCellValidator = (
  column: Pick<TemplateColumn, "required" | "validators">,
): ((value: string) => Array<string>) => {
  const rules = column.validators ?? [];
  const compiled = rules.map(
    (rule) =>
      [
        rule,
        rule.type === "regex" ? new RegExp(rule.pattern) : undefined,
      ] as const,
  );
  const hasRequiredRule = rules.some((rule) => rule.type === "required");

  return (value) => {
    const errors: Array<string> = [];

    if (column.required && !hasRequiredRule) {
      const requiredError = checkRule(value, { type: "required" });

      if (requiredError) {
        errors.push(requiredError);
      }
    }

    for (const [rule, regex] of compiled) {
      const error = checkRule(value, rule, regex);

      if (error) {
        errors.push(error);
      }
    }

    return errors;
  };
};

export const runValidators = (
  value: string,
  rules: Array<ValidatorRule>,
): Array<string> =>
  createCellValidator({ required: false, validators: rules })(value);

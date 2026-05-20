import { describe, it, expect } from "vitest";
import { formatMessage, formatRelativeTime, timeBucket } from "../src/lib/i18n";

describe("formatMessage", () => {
  it("returns template unchanged when no vars", () => {
    expect(formatMessage("Hello world")).toBe("Hello world");
  });

  it("replaces single variable", () => {
    expect(formatMessage("Hello {name}", { name: "World" })).toBe("Hello World");
  });

  it("replaces multiple variables", () => {
    expect(formatMessage("{a} + {b} = {c}", { a: "1", b: "2", c: "3" })).toBe("1 + 2 = 3");
  });

  it("replaces number variables", () => {
    expect(formatMessage("{count} items", { count: 42 })).toBe("42 items");
  });

  it("leaves placeholder when var is missing", () => {
    expect(formatMessage("Hello {name}", {})).toBe("Hello {name}");
  });

  it("handles consecutive vars", () => {
    expect(formatMessage("{a}{b}", { a: "x", b: "y" })).toBe("xy");
  });

  it("returns empty string for empty input", () => {
    expect(formatMessage("")).toBe("");
  });
});

describe("formatRelativeTime", () => {
  const mockT = (key: string, vars?: Record<string, string | number>) => {
    const table: Record<string, string> = {
      today: "today",
      yesterday: "yesterday",
      days_ago: "{n} days ago",
      weeks_ago: "{n} weeks ago",
      months_ago: "{n} months ago",
      years_ago: "{n} years ago",
    };
    const tmpl = table[key] || key;
    return vars ? tmpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : tmpl;
  };

  it('returns "today" for 0 days', () => {
    expect(formatRelativeTime(Date.now(), mockT)).toBe("today");
  });

  it('returns "yesterday" for 1 day ago', () => {
    const oneDayAgo = Date.now() - 86400000;
    expect(formatRelativeTime(oneDayAgo, mockT)).toBe("yesterday");
  });

  it('returns "N days ago" for less than 7 days', () => {
    const threeDaysAgo = Date.now() - 3 * 86400000;
    expect(formatRelativeTime(threeDaysAgo, mockT)).toBe("3 days ago");
  });

  it('returns "N weeks ago" for less than 30 days', () => {
    const twoWeeksAgo = Date.now() - 14 * 86400000;
    expect(formatRelativeTime(twoWeeksAgo, mockT)).toBe("2 weeks ago");
  });

  it('returns "N months ago" for less than 365 days', () => {
    const threeMonthsAgo = Date.now() - 90 * 86400000;
    expect(formatRelativeTime(threeMonthsAgo, mockT)).toBe("3 months ago");
  });

  it('returns "N years ago" for more than a year', () => {
    const twoYearsAgo = Date.now() - 730 * 86400000;
    expect(formatRelativeTime(twoYearsAgo, mockT)).toBe("2 years ago");
  });

  it('returns exact "1 day" at boundary', () => {
    const almostTwoDays = Date.now() - 86400000 - 1;
    expect(formatRelativeTime(almostTwoDays, mockT)).toBe("yesterday");
  });
});

describe("timeBucket", () => {
  const mockT = (key: string, vars?: Record<string, string | number>) => {
    const table: Record<string, string> = {
      today: "today",
      yesterday: "yesterday",
      days_ago: "{n} days ago",
      weeks_ago: "{n} weeks ago",
      months_ago: "{n} months ago",
      years_ago: "{n} years ago",
      this_week: "this_week",
      last_year: "last_year",
      year_before_last: "year_before_last",
    };
    const tmpl = table[key] || key;
    return vars ? tmpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : tmpl;
  };

  it('returns "today" for 0 days', () => {
    expect(timeBucket(Date.now(), mockT)).toBe("today");
  });

  it('returns "yesterday" for 1 day ago', () => {
    expect(timeBucket(Date.now() - 86400000, mockT)).toBe("yesterday");
  });

  it('returns "this_week" for 2-6 days ago', () => {
    expect(timeBucket(Date.now() - 3 * 86400000, mockT)).toBe("this_week");
  });

  it('returns "N days ago" for 7-29 days', () => {
    expect(timeBucket(Date.now() - 10 * 86400000, mockT)).toBe("10 days ago");
  });

  it('returns "N months ago" for 1-11 months', () => {
    expect(timeBucket(Date.now() - 60 * 86400000, mockT)).toBe("2 months ago");
  });

  it('returns "last_year" for ~1 year ago', () => {
    expect(timeBucket(Date.now() - 400 * 86400000, mockT)).toBe("last_year");
  });

  it('returns "year_before_last" for 2 years ago', () => {
    expect(timeBucket(Date.now() - 730 * 86400000, mockT)).toBe("year_before_last");
  });

  it('returns "N years ago" for 3+ years', () => {
    expect(timeBucket(Date.now() - 1095 * 86400000, mockT)).toBe("3 years ago");
  });
});

import { describe, expect, it } from "vitest";
import {
  formatSchoolYear,
  parseSchoolYear,
  schoolYearChoices,
  schoolYearOf,
} from "../officers";

describe("schoolYearOf", () => {
  it("puts June onwards in the year that is starting", () => {
    expect(schoolYearOf(new Date(2026, 5, 1))).toBe("2026-2027");
    expect(schoolYearOf(new Date(2026, 8, 15))).toBe("2026-2027");
    expect(schoolYearOf(new Date(2026, 11, 31))).toBe("2026-2027");
  });

  it("keeps January to May in the year that began the June before", () => {
    expect(schoolYearOf(new Date(2027, 0, 1))).toBe("2026-2027");
    expect(schoolYearOf(new Date(2027, 4, 31))).toBe("2026-2027");
  });
});

describe("parseSchoolYear", () => {
  it("accepts consecutive years", () => {
    expect(parseSchoolYear("2026-2027")).toBe("2026-2027");
  });

  it("rejects anything else", () => {
    expect(parseSchoolYear("2026-2028")).toBeNull();
    expect(parseSchoolYear("2027-2026")).toBeNull();
    expect(parseSchoolYear("2026–2027")).toBeNull();
    expect(parseSchoolYear("2026")).toBeNull();
    expect(parseSchoolYear("")).toBeNull();
  });
});

describe("schoolYearChoices", () => {
  it("offers recent years and the next, newest first, keeping older ones in use", () => {
    const choices = schoolYearChoices(new Date(2026, 8, 1), ["2019-2020"]);
    expect(choices).toEqual([
      "2027-2028",
      "2026-2027",
      "2025-2026",
      "2024-2025",
      "2023-2024",
      "2019-2020",
    ]);
  });
});

describe("formatSchoolYear", () => {
  it("uses an en dash for display", () => {
    expect(formatSchoolYear("2026-2027")).toBe("2026–2027");
  });
});

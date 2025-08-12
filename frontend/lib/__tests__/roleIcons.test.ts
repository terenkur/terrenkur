import { getSubBadge } from "../roleIcons";

describe("getSubBadge", () => {
  test("returns undefined for 0 months", () => {
    expect(getSubBadge(0)).toBeUndefined();
  });

  test.each([
    [1, "1"],
    [2, "2"],
    [3, "3"],
    [5, "3"],
    [6, "6"],
    [8, "6"],
    [9, "9"],
    [11, "9"],
    [12, "12"],
    [17, "12"],
    [18, "18"],
    [23, "18"],
    [24, "24"],
  ])("returns %s.svg for %i months", (months, badge) => {
    expect(getSubBadge(months)).toBe(`/icons/subs/${badge}.svg`);
  });
});


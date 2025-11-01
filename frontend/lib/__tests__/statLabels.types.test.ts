import { INTIM_LABELS, POCELUY_LABELS } from "../statLabels";
import sharedTypes from "../../../shared/intimPoceluyTypes.json";
import ru from "../../locales/ru.json";

const { intim, poceluy } = sharedTypes as {
  intim: string[];
  poceluy: string[];
};

const toObsKey = (type: string): string =>
  `obs${type
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("")}`;

describe("stat label coverage", () => {
  it("includes labels for every intim type", () => {
    expect(new Set(Object.keys(INTIM_LABELS))).toEqual(new Set(intim));
  });

  it("includes labels for every poceluy type", () => {
    expect(new Set(Object.keys(POCELUY_LABELS))).toEqual(new Set(poceluy));
  });

  it("provides OBS translations for every intim type", () => {
    for (const type of intim) {
      expect(ru).toHaveProperty(toObsKey(type));
    }
  });

  it("provides OBS translations for every poceluy type", () => {
    for (const type of poceluy) {
      expect(ru).toHaveProperty(toObsKey(type));
    }
  });
});

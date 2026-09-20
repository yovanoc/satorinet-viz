import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CalendarForm } from "../components/date-picker";
import { Calendar } from "../components/ui/calendar";

import { formatDateOnly } from "./date";
import { formatDateParam } from "./date-param";

test("date-only picker and chart values keep their UTC calendar day", () => {
  const previousTimeZone = process.env.TZ;
  const selected = new Date("2026-01-15T00:00:00.000Z");
  assert.equal(formatDateOnly("not-a-date", "en-US"), "Invalid Date");

  try {
    for (const timeZone of ["America/Los_Angeles", "Pacific/Kiritimati"]) {
      process.env.TZ = timeZone;
      assert.equal(formatDateParam(selected), "2026-01-15", timeZone);
      const picker = renderToStaticMarkup(createElement(CalendarForm, {
        selectedDate: selected, onDateChange: () => {},
      }));
      assert.match(picker, /Jan 15, 2026/, timeZone);
      const calendar = renderToStaticMarkup(createElement(Calendar, {
        mode: "single", timeZone: "UTC", selected, defaultMonth: selected,
      }));
      assert.match(calendar, /aria-selected="true" data-day="2026-01-15"/, timeZone);
      assert.equal(
        formatDateOnly(selected, "en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        "Jan 15, 2026",
        timeZone,
      );
      assert.equal(
        formatDateOnly("2026-01-15", "en-US", {
          month: "short",
          day: "numeric",
        }),
        "Jan 15",
        timeZone,
      );
    }
  } finally {
    if (previousTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimeZone;
  }
});

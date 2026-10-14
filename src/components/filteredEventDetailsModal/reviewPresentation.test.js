/** @jest-environment node */
import fs from "fs";
import path from "path";

const modalStyles = fs.readFileSync(path.join(__dirname, "index.style.js"), "utf8");
const tableStyles = fs.readFileSync(path.join(__dirname, "../filteredEventsListPanel/index.style.js"), "utf8");
const rules = text => Array.from(text.matchAll(/([^{}]+)\{([^{}]*)\}/g));
const style = selector => rules(modalStyles).find(rule => rule[1].trim().endsWith(selector))[2];

it("groups navigation at the right and keeps bounded bordered buttons", () => {
  expect(style(".filtered-event-review-navigation")).toContain("justify-content: flex-end");
  expect(style(".filtered-event-review-navigation")).toContain("margin-inline-start: auto");
  expect(style(".filtered-event-review-button")).toContain("min-width: 0");
  expect(style(".filtered-event-review-navigation .ant-btn")).toContain("border: 1px solid");
  expect(style(".filtered-event-review-navigation .ant-btn")).toContain("background: #fafafa");
  expect(style(".filtered-event-review-name")).toContain("text-overflow: ellipsis");
  expect(style(".filtered-event-review-bar")).toContain("flex-wrap: wrap");
});

it("dims reviewed cells without overriding button links or Typography links", () => {
  const reviewedRules = rules(tableStyles).filter(rule => rule[1].includes("filtered-events-event-reviewed"));
  expect(reviewedRules.some(rule => rule[2].includes("background: #f5f5f5"))).toBe(true);
  for (const [, selector] of reviewedRules) {
    expect(selector).not.toContain(".ant-btn-link");
  }
  expect(reviewedRules.filter(rule => rule[1].includes(".ant-typography"))
    .every(rule => rule[1].includes(".ant-typography:not(a)"))).toBe(true);
  expect(tableStyles).toContain("tr.filtered-events-event-current > td");
});

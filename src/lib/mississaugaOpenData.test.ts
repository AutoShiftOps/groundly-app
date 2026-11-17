import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFilteredDirectoryCitationUrl,
  buildNaicsPriorityPlan,
  DEFAULT_MISSISSAUGA_QUERY_URL,
  formatDirectoryPeerSnippet,
  summarizeEmploymentHubs,
} from "./mississaugaOpenData";

test("buildNaicsPriorityPlan routes catering businesses to exact NAICS 722320", () => {
  const plan = buildNaicsPriorityPlan({
    businessName: "Food Mamba",
    idea: "Corporate catering and events platform",
    sectorKeywords: ["CATER", "FOOD", "RESTAURANT"],
  });
  assert.equal(plan.exactWhereClause, "NAICSCode = '722320'");
  assert.equal(plan.broadWhereClause, "NAICSCode LIKE '722%'");
});

test("buildFilteredDirectoryCitationUrl returns human-readable pjson filtered query URL", () => {
  const url = buildFilteredDirectoryCitationUrl(
    DEFAULT_MISSISSAUGA_QUERY_URL,
    "NAICSCode = '722320'",
  );
  assert.ok(url.includes("f=pjson"));
  assert.ok(url.includes("722320"));
  assert.ok(!url.includes("explore?location="));
});

test("formatDirectoryPeerSnippet includes concrete peer business names and locations", () => {
  const snippet = formatDirectoryPeerSnippet({
    exactMatch: false,
    businessName: "Food Mamba",
    matchedCount: 8,
    totalSectorCount: 34,
    categoryLabel: "Caterers (NAICS 722320)",
    rows: [
      {
        BusinessName: "Cabral Catering",
        NAICSDescription: "Caterers",
        CHArea: "Northeast EA (West)",
        EmplRange: "5 to 9",
      },
      {
        BusinessName: "Coco Bellas Cafe and Catering",
        NAICSDescription: "Caterers",
        CHArea: "Meadowvale Business Park CC",
        EmplRange: "1 to 4",
      },
    ],
  });
  assert.ok(snippet.includes("Cabral Catering"));
  assert.ok(snippet.includes("Meadowvale Business Park CC"));
  assert.ok(snippet.includes("34 total registered"));
});

test("summarizeEmploymentHubs totals Mississauga 2025 office and hybrid buyers", () => {
  const summary = summarizeEmploymentHubs([
    {
      CA_Type: "Corporate Centres (CC)",
      Working_From_Workplace: 30870,
      Hybrid_Employees: 32065,
      Total_Employees_Based_on_Responding_Businesses: 123178,
    },
    {
      CA_Type: "Downtown (DT)",
      Working_From_Workplace: 18369,
      Hybrid_Employees: 10750,
      Total_Employees_Based_on_Responding_Businesses: 47309,
    },
  ]);
  assert.ok(summary);
  assert.equal(summary.corporateAndDowntownActiveBuyers, 92054);
  assert.ok(summary.snippet.includes("123,178"));
});

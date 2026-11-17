export const DEFAULT_MISSISSAUGA_QUERY_URL =
  "https://services6.arcgis.com/hM5ymMLbxIyWTjn2/arcgis/rest/services/2025_Mississauga_Business_Directory/FeatureServer/0/query";

export const MISSISSAUGA_EMPLOYMENT_QUERY_URL =
  "https://services6.arcgis.com/hM5ymMLbxIyWTjn2/arcgis/rest/services/MED_2025_Employment_byCAType/FeatureServer/0/query";

export const MISSISSAUGA_EATERIES_QUERY_URL =
  "https://services6.arcgis.com/hM5ymMLbxIyWTjn2/arcgis/rest/services/Mississauga_Licensed_Eateries/FeatureServer/0/query";

export interface MississaugaBizRecord {
  BusinessName?: string;
  NAICSSector?: string;
  NAICSCode?: number | string;
  NAICSDescription?: string;
  EmplRange?: string;
  CHArea?: string;
  Ward?: number;
  StreetAddress?: string;
  WebAddress?: string;
}

export interface MississaugaEmploymentRow {
  CA_Type?: string;
  Remote_Employees?: number;
  Hybrid_Employees?: number;
  Working_From_Workplace?: number;
  Total_Employees_Based_on_Responding_Businesses?: number;
}

export interface MississaugaEateryRecord {
  BUSINESSNAME?: string;
  BUSINESSTYPE?: string;
  STREET?: string;
  POSTAL?: string;
}

export interface NaicsPriorityPlan {
  exactWhereClause: string | null;
  broadWhereClause: string | null;
  categoryLabel: string;
}

/**
 * Prioritize specific 6-digit NAICS categories before falling back to broad keyword OR clauses,
 * so "Food Mamba" (catering) pulls actual registered Mississauga caterers (NAICS 722320) instead of
 * unrelated meat wholesalers or general retail.
 */
export function buildNaicsPriorityPlan(params: {
  businessName?: string;
  idea?: string;
  industry?: string;
  sectorKeywords: string[];
}): NaicsPriorityPlan {
  const combined = `${params.businessName || ""} ${params.idea || ""} ${params.industry || ""}`;

  if (/\b(cater|banquet|event\s+food|corporate\s+lunch|office\s+meal|tiffin|commissary)\b/i.test(combined) ||
      params.sectorKeywords[0] === "CATER") {
    return {
      exactWhereClause: "NAICSCode = '722320'",
      broadWhereClause: "NAICSCode LIKE '722%'",
      categoryLabel: "Caterers (NAICS 722320) & Food Services (722)",
    };
  }

  if (params.sectorKeywords.includes("FOOD") || params.sectorKeywords.includes("RESTAURANT")) {
    return {
      exactWhereClause: "NAICSCode LIKE '7225%' OR NAICSCode = '722320'",
      broadWhereClause: "NAICSCode LIKE '722%'",
      categoryLabel: "Restaurants & Food Services (NAICS 722)",
    };
  }

  if (params.sectorKeywords.includes("HEALTH") || params.sectorKeywords.includes("CLINIC")) {
    return {
      exactWhereClause: "NAICSCode LIKE '621%'",
      broadWhereClause: "NAICSCode LIKE '62%'",
      categoryLabel: "Ambulatory Health Care & Clinics (NAICS 621)",
    };
  }

  if (params.sectorKeywords.includes("SOFTWARE") || params.sectorKeywords.includes("TECHNOLOGY")) {
    return {
      exactWhereClause: "NAICSCode LIKE '5415%' OR NAICSCode = '511210'",
      broadWhereClause: "NAICSCode LIKE '541%'",
      categoryLabel: "Computer Systems Design & Software (NAICS 5415/5112)",
    };
  }

  return {
    exactWhereClause: null,
    broadWhereClause: null,
    categoryLabel: params.sectorKeywords.join(", ") || "Local Commercial Peers",
  };
}

/**
 * Build a transparent, human-readable ArcGIS FeatureServer query URL (?f=pjson) showing the
 * exact filtered query used for citation evidence instead of an unfiltered 14,637-pin city map.
 */
export function buildFilteredDirectoryCitationUrl(
  endpoint: string,
  whereClause: string,
  outFields = "BusinessName,NAICSCode,NAICSDescription,EmplRange,CHArea,Ward,StreetAddress,WebAddress",
): string {
  try {
    const url = new URL(endpoint);
    url.searchParams.set("where", whereClause);
    url.searchParams.set("outFields", outFields);
    url.searchParams.set("resultRecordCount", "15");
    url.searchParams.set("f", "pjson");
    return url.toString();
  } catch {
    return endpoint;
  }
}

export function formatDirectoryPeerSnippet(params: {
  exactMatch: boolean;
  businessName?: string;
  rows: MississaugaBizRecord[];
  matchedCount: number;
  totalSectorCount?: number;
  categoryLabel?: string;
}): string {
  const peerPreviews = params.rows
    .slice(0, 4)
    .map((r) => {
      const area = r.CHArea || (r.Ward ? `Ward ${r.Ward}` : "Mississauga");
      const size = r.EmplRange ? `, ${r.EmplRange} staff` : "";
      return `${r.BusinessName} (${r.NAICSDescription || r.NAICSSector || "Commercial"}, ${area}${size})`;
    })
    .join("; ");

  if (params.exactMatch) {
    return `Matched ${params.matchedCount} exact record(s) in 2025 Mississauga Business Directory: ${peerPreviews}.`;
  }

  const totalText =
    params.totalSectorCount && params.totalSectorCount > params.matchedCount
      ? `${params.totalSectorCount} total registered in Mississauga`
      : `${params.matchedCount} sampled peers`;

  return `Trade name "${params.businessName || "venture"}" is unlisted by DBA name in the 2025 snapshot; retrieved ${params.categoryLabel || "category"} peers (${totalText}) including: ${peerPreviews}.`;
}

export function summarizeEmploymentHubs(rows: MississaugaEmploymentRow[]): {
  summary: string;
  snippet: string;
  totalSurveyed: number;
  corporateAndDowntownActiveBuyers: number;
} | null {
  if (!rows || rows.length === 0) return null;

  const findRow = (prefix: string) =>
    rows.find((r) => (r.CA_Type || "").toLowerCase().includes(prefix.toLowerCase()));

  const cc = findRow("Corporate Centres");
  const dt = findRow("Downtown");
  const ea = findRow("Employment Areas");

  const totalSurveyed = Math.round(
    rows.reduce(
      (sum, r) => sum + (Number(r.Total_Employees_Based_on_Responding_Businesses) || 0),
      0,
    ),
  );

  const ccInOffice = Math.round(Number(cc?.Working_From_Workplace) || 0);
  const ccHybrid = Math.round(Number(cc?.Hybrid_Employees) || 0);
  const ccTotal = Math.round(Number(cc?.Total_Employees_Based_on_Responding_Businesses) || 0);

  const dtInOffice = Math.round(Number(dt?.Working_From_Workplace) || 0);
  const dtHybrid = Math.round(Number(dt?.Hybrid_Employees) || 0);
  const dtTotal = Math.round(Number(dt?.Total_Employees_Based_on_Responding_Businesses) || 0);

  const eaInOffice = Math.round(Number(ea?.Working_From_Workplace) || 0);
  const eaHybrid = Math.round(Number(ea?.Hybrid_Employees) || 0);
  const eaTotal = Math.round(Number(ea?.Total_Employees_Based_on_Responding_Businesses) || 0);

  const corporateAndDowntownActiveBuyers = ccInOffice + ccHybrid + dtInOffice + dtHybrid;

  const lines = [
    `MISSISSAUGA 2025 EMPLOYMENT & WORKPLACE MODE SURVEY (MED_2025_Employment_byCAType — ${totalSurveyed.toLocaleString("en-US")} surveyed workers):`,
    cc
      ? `- Corporate Centres (CC): ${ccTotal.toLocaleString("en-US")} total employees (${ccInOffice.toLocaleString("en-US")} full on-site + ${ccHybrid.toLocaleString("en-US")} hybrid = ${(ccInOffice + ccHybrid).toLocaleString("en-US")} active office commuters)`
      : null,
    dt
      ? `- Downtown Mississauga (DT): ${dtTotal.toLocaleString("en-US")} total employees (${dtInOffice.toLocaleString("en-US")} full on-site + ${dtHybrid.toLocaleString("en-US")} hybrid = ${(dtInOffice + dtHybrid).toLocaleString("en-US")} active downtown workers)`
      : null,
    ea
      ? `- Employment Areas (EA): ${eaTotal.toLocaleString("en-US")} total employees (${eaInOffice.toLocaleString("en-US")} full on-site + ${eaHybrid.toLocaleString("en-US")} hybrid)`
      : null,
  ].filter(Boolean);

  const snippet = `2025 City Employment Survey across ${totalSurveyed.toLocaleString("en-US")} workers: Corporate Centres hold ${ccTotal.toLocaleString("en-US")} employees (${(ccInOffice + ccHybrid).toLocaleString("en-US")} on-site/hybrid) and Downtown holds ${dtTotal.toLocaleString("en-US")} (${(dtInOffice + dtHybrid).toLocaleString("en-US")} on-site/hybrid), quantifying local B2B office demand.`;

  return {
    summary: lines.join("\n"),
    snippet,
    totalSurveyed,
    corporateAndDowntownActiveBuyers,
  };
}

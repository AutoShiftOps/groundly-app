// GitHub issue #18 follow-up (user feedback: browser print-to-PDF
// produced misaligned graphics and a print-dialog step; asked for a
// real direct-download brochure PDF instead). Built with
// @react-pdf/renderer -- draws real PDF primitives (text, vector
// shapes, pages) directly, not a screenshot/print of the HTML DOM, so
// none of print.css's page-break/pagination/filter workarounds apply
// or are needed here. Same real data as the live report and the
// (now-retired) print view: every number, citation, and null-when-
// ungrounded gap comes straight from `report`, nothing fabricated or
// idealized for the PDF specifically.
//
// A few small pure helpers below (dedupeCitations, stripMarketTags,
// lastSentence, marketTiersFromApi, computeEvidenceScore) are
// deliberately duplicated from ReportView.jsx rather than imported --
// ReportView.jsx has no named exports (default export only) and this
// file must stay renderable standalone via @react-pdf/renderer's own
// `pdf()` call, not mounted through ReportView's own tree. Each is a
// small, stable, already-tested pure function; keep both copies in
// sync if the logic they express ever changes.
import {
  Document, Page, View, Text, Svg, Circle, Line, Rect, G, StyleSheet,
} from "@react-pdf/renderer";

const COLOR = {
  bg: "#ffffff",
  bgPanel: "#f4f6fb",
  border: "#dde4f2",
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#94a3b8",
  blue: "#4a8fff",
  teal: "#0d9488",
  purple: "#7c3aed",
  purpleLight: "#8b5cf6",
  amber: "#b45309",
  red: "#dc2626",
};
// Amber/red/teal above are shifted a few shades darker than the live
// app's own PALETTE (which is tuned for a near-black background) --
// on a white PDF page the live app's literal hex values (e.g. amber
// #f59e0b, teal #2dd4bf) read as too pale/low-contrast for body text
// and thin strokes. Same hue family, tuned for light-background
// contrast instead of dark.

function ToneColor(tone) {
  return { teal: COLOR.teal, amber: COLOR.amber, red: COLOR.red }[tone] || COLOR.amber;
}

function dedupeCitations(citations) {
  if (!citations || citations.length === 0) return [];
  const bySource = {};
  citations.forEach((c) => {
    const existing = bySource[c.source_url];
    if (!existing || c.similarity > existing.similarity) bySource[c.source_url] = c;
  });
  return Object.values(bySource).sort((a, b) => b.similarity - a.similarity);
}

function stripMarketTags(text) {
  return text ? text.replace(/\[(TAM|SAM|SOM)\]\s*/gi, "") : text;
}

function lastSentence(text) {
  if (!text) return "";
  const sentences = text.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  return sentences.length ? sentences[sentences.length - 1] : text.trim();
}

const MARKET_TIER_META = {
  tam: { label: "TAM", color: COLOR.blue },
  sam: { label: "SAM", color: COLOR.purple },
  som: { label: "SOM", color: COLOR.teal },
};

function marketTiersFromApi(marketSizing) {
  if (!marketSizing) return [];
  return Object.entries(MARKET_TIER_META).map(([key, meta]) => {
    const tier = marketSizing[key];
    if (!tier) {
      return { key, label: meta.label, color: meta.color, present: false, value: null, displayValue: null, citationIndex: null, cagrPct: null, tierDescription: null };
    }
    return {
      key, label: meta.label, color: meta.color, present: true, value: tier.value_usd, displayValue: tier.label,
      citationIndex: tier.citation_index, cagrPct: tier.cagr_pct ?? null, tierDescription: tier.tier_description ?? null,
    };
  });
}

function computeEvidenceScore(metric, report) {
  if (!metric) return null;
  const citations = report?.results?.[metric.source_framework]?.citations || [];
  if (citations.length === 0) return null;
  const cited = metric.citation_index ? citations.find((c) => c.index === metric.citation_index) : null;
  const similarity = cited ? cited.similarity : citations.reduce((sum, c) => sum + c.similarity, 0) / citations.length;
  return Math.round(similarity * 100) / 10;
}

function computeStats(report) {
  const frameworks = Object.keys(report?.results || {});
  const verifiedCount = frameworks.filter((fw) => report.verification?.[fw]?.verified).length;
  const totalFrameworks = frameworks.length;
  let totalCitations = 0, similaritySum = 0, similarityCount = 0;
  frameworks.forEach((fw) => {
    const citations = report.results[fw]?.citations || [];
    const seen = new Set();
    citations.forEach((c) => {
      if (!seen.has(c.source_url)) { seen.add(c.source_url); totalCitations += 1; }
      similaritySum += c.similarity;
      similarityCount += 1;
    });
  });
  const avgSimilarity = similarityCount ? Math.round((similaritySum / similarityCount) * 100) : 0;
  const unverifiedCount = totalFrameworks - verifiedCount;
  let verdict = "Insufficient Data", verdictSub = "Not enough grounded sources yet to form a verdict.", tone = "amber";
  if (totalFrameworks > 0 && verifiedCount === totalFrameworks) {
    verdict = "Proceed With Confidence";
    verdictSub = "All frameworks are backed by verified, grounded sources.";
    tone = "teal";
  } else if (verifiedCount > 0) {
    verdict = "Proceed With Caution";
    verdictSub = `${unverifiedCount} of ${totalFrameworks} sections need stronger sourcing.`;
    tone = "amber";
  } else if (totalFrameworks > 0) {
    verdict = "Gather More Sources";
    verdictSub = "No sections passed grounding verification yet.";
    tone = "red";
  }
  return { frameworks, verifiedCount, totalFrameworks, totalCitations, avgSimilarity, unverifiedCount, verdict, verdictSub, tone };
}

const BUSINESS_METRIC_CARDS = [
  { key: "market_size", label: "Market Size" },
  { key: "competitive_pressure", label: "Competitive Pressure" },
  { key: "customer_segment", label: "Best Customer Segment" },
  { key: "business_model_fit", label: "Business Model Fit" },
  { key: "risk_flags", label: "Risk Flags" },
];

// Category-block layouts, ported 1:1 (key/label/color) from
// ReportView.jsx's own PESTEL_BLOCKS/SWOT_QUADRANTS/etc -- lucide-react
// Icons dropped (react-pdf's <Svg> can't render arbitrary DOM SVG
// React components) in favor of a plain colored square marker.
const PESTEL_BLOCKS = [
  { key: "political", label: "Political", color: COLOR.blue },
  { key: "economic", label: "Economic", color: COLOR.teal },
  { key: "social", label: "Social", color: COLOR.purple },
  { key: "technological", label: "Technological", color: COLOR.purpleLight },
  { key: "environmental", label: "Environmental", color: COLOR.amber },
  { key: "legal", label: "Legal", color: COLOR.red },
];
const SWOT_QUADRANTS = [
  { key: "strengths", label: "Strengths", color: COLOR.teal },
  { key: "weaknesses", label: "Weaknesses", color: COLOR.red },
  { key: "opportunities", label: "Opportunities", color: COLOR.blue },
  { key: "threats", label: "Threats", color: COLOR.amber },
];
const PORTER_FORCES_BLOCKS = [
  { key: "competitive_rivalry", label: "Competitive Rivalry", color: COLOR.red },
  { key: "threat_of_new_entrants", label: "Threat of New Entrants", color: COLOR.amber },
  { key: "bargaining_power_of_suppliers", label: "Bargaining Power of Suppliers", color: COLOR.purple },
  { key: "bargaining_power_of_buyers", label: "Bargaining Power of Buyers", color: COLOR.blue },
  { key: "threat_of_substitutes", label: "Threat of Substitutes", color: COLOR.teal },
];
const STP_BLOCKS = [
  { key: "segmentation", label: "Segmentation", color: COLOR.blue },
  { key: "targeting", label: "Targeting", color: COLOR.purpleLight },
  { key: "positioning", label: "Positioning", color: COLOR.teal },
];
const BMC_BLOCKS = [
  { key: "key_partners", label: "Key Partners", color: COLOR.purpleLight },
  { key: "key_activities", label: "Key Activities", color: COLOR.amber },
  { key: "value_propositions", label: "Value Propositions", color: COLOR.teal },
  { key: "key_resources", label: "Key Resources", color: COLOR.purple },
  { key: "customer_relationships", label: "Customer Relationships", color: COLOR.red },
  { key: "customer_segments", label: "Customer Segments", color: COLOR.blue },
  { key: "channels", label: "Channels", color: COLOR.purpleLight },
  { key: "cost_structure", label: "Cost Structure", color: COLOR.blue },
  { key: "revenue_streams", label: "Revenue Streams", color: COLOR.blue },
];
const VALUE_CHAIN_BLOCKS = [
  { key: "firm_infrastructure", label: "Firm Infrastructure", color: COLOR.purpleLight },
  { key: "human_resource_management", label: "HR Management", color: COLOR.purpleLight },
  { key: "technology_development", label: "Technology Development", color: COLOR.purpleLight },
  { key: "procurement", label: "Procurement", color: COLOR.purpleLight },
  { key: "inbound_logistics", label: "Inbound Logistics", color: COLOR.red },
  { key: "operations", label: "Operations", color: COLOR.red },
  { key: "outbound_logistics", label: "Outbound Logistics", color: COLOR.red },
  { key: "marketing_and_sales", label: "Marketing & Sales", color: COLOR.red },
  { key: "service", label: "Service", color: COLOR.red },
];
const BALANCED_SCORECARD_BLOCKS = [
  { key: "financial", label: "Financial", color: COLOR.teal },
  { key: "customer", label: "Customer", color: COLOR.blue },
  { key: "internal_process", label: "Internal Process", color: COLOR.purple },
  { key: "learning_and_growth", label: "Learning & Growth", color: COLOR.amber },
];
const BCG_QUADRANT_LAYOUT = [
  { key: "question_mark", label: "Question Mark", color: COLOR.amber },
  { key: "star", label: "Star", color: COLOR.teal },
  { key: "dog", label: "Dog", color: COLOR.red },
  { key: "cash_cow", label: "Cash Cow", color: COLOR.blue },
];
const ANSOFF_QUADRANT_LAYOUT = [
  { key: "market_development", label: "Market Development", color: COLOR.blue },
  { key: "diversification", label: "Diversification", color: COLOR.red },
  { key: "market_penetration", label: "Market Penetration", color: COLOR.teal },
  { key: "product_development", label: "Product Development", color: COLOR.amber },
];

// framework key -> (field name on `result`, category block layout) for
// every qualitative category-based framework -- covers 6 of the 10
// frameworks with one shared page renderer (CategoryFrameworkBody).
const CATEGORY_FRAMEWORKS = {
  pestel: { field: "pestel_analysis", blocks: PESTEL_BLOCKS },
  swot: { field: "swot_analysis", blocks: SWOT_QUADRANTS },
  porter: { field: "porter_forces", blocks: PORTER_FORCES_BLOCKS },
  stp: { field: "stp_analysis", blocks: STP_BLOCKS },
  bmc: { field: "bmc_canvas", blocks: BMC_BLOCKS },
  value_chain: { field: "value_chain", blocks: VALUE_CHAIN_BLOCKS },
};

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 44, paddingHorizontal: 44, fontSize: 9, color: COLOR.textPrimary, fontFamily: "Helvetica" },
  coverPage: { paddingTop: 90, paddingHorizontal: 56, fontFamily: "Helvetica" },
  row: { flexDirection: "row" },
  brandRow: { flexDirection: "row", alignItems: "center", marginBottom: 36 },
  brandName: { fontSize: 13, fontWeight: 700, color: COLOR.textPrimary },
  brandSub: { fontSize: 7, color: COLOR.textMuted, letterSpacing: 1, textTransform: "uppercase", marginTop: 2 },
  kicker: { fontSize: 10, fontWeight: 700, color: COLOR.blue, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
  coverTitle: { fontSize: 28, fontWeight: 700, color: COLOR.textPrimary, marginBottom: 14, lineHeight: 1.25 },
  coverMeta: { fontSize: 10, color: COLOR.textSecondary },
  sectionKicker: { fontSize: 8, fontWeight: 700, color: COLOR.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 },
  h1: { fontSize: 16, fontWeight: 700, color: COLOR.textPrimary, marginBottom: 3 },
  h2sub: { fontSize: 9, color: COLOR.textMuted, marginBottom: 16 },
  panel: { backgroundColor: COLOR.bgPanel, borderRadius: 8, borderWidth: 1, borderColor: COLOR.border, padding: 12 },
  pill: { borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, fontSize: 7.5, fontWeight: 700 },
  categoryLabel: { fontSize: 8.5, fontWeight: 700, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.4 },
  bulletRow: { flexDirection: "row", marginBottom: 4, paddingRight: 4 },
  bulletDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: COLOR.textMuted, marginTop: 3.5, marginRight: 5 },
  bulletText: { fontSize: 8.5, color: COLOR.textPrimary, lineHeight: 1.5, flex: 1 },
  citeMark: { color: COLOR.blue, fontWeight: 700 },
  emptyText: { fontSize: 8, color: COLOR.textMuted, fontStyle: "italic" },
  footer: { position: "absolute", bottom: 20, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: COLOR.textMuted, borderTopWidth: 1, borderTopColor: COLOR.border, paddingTop: 6 },
});

function Footer({ idea, pageLabel }) {
  return (
    <View style={s.footer} fixed>
      <Text>Groundly &middot; {idea}</Text>
      {/* Plain JS template literal, not JSX text -- "&middot;" here would
          print literally instead of decoding to a bullet, unlike the
          JSX-text "&middot;" uses elsewhere in this file. */}
      <Text render={({ pageNumber, totalPages }) => `${pageLabel} · Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

function GroundlyMark({ size = 22 }) {
  // Vector redraw of the app's own hexagon+ring "G" mark using react-pdf's
  // Svg primitives (the live app's version is hand-drawn DOM SVG with a
  // gradient stroke + dasharray ring, not reusable here directly, but the
  // same shapes/geometry).
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={{ marginRight: 8 }}>
      <Circle cx={12} cy={12} r={10.5} stroke={COLOR.blue} strokeWidth={1.4} fill="none" />
      <Circle cx={12} cy={12} r={6.2} stroke={COLOR.purple} strokeWidth={1.6} fill="none" />
      <Line x1={12.5} y1={12} x2={18} y2={12} stroke={COLOR.purple} strokeWidth={1.6} />
    </Svg>
  );
}

function BrandRow() {
  return (
    <View style={s.brandRow}>
      <GroundlyMark />
      <View>
        <Text style={s.brandName}>Groundly</Text>
        <Text style={s.brandSub}>AI Analysis Platform</Text>
      </View>
    </View>
  );
}

function Bullet({ item }) {
  return (
    <View style={s.bulletRow}>
      <View style={s.bulletDot} />
      <Text style={s.bulletText}>
        {item.text}
        {item.citation_index != null && <Text style={s.citeMark}> [{item.citation_index}]</Text>}
        {item.metric_value != null && (
          <Text style={{ fontWeight: 700 }}>
            {"  "}{item.metric_name}: {item.metric_value}
            {item.target_value != null && <Text style={{ color: COLOR.textMuted, fontWeight: 400 }}> (target {item.target_value})</Text>}
          </Text>
        )}
      </Text>
    </View>
  );
}

function CategoryBlock({ block, items }) {
  const isEmpty = !items || items.length === 0;
  return (
    <View style={[s.panel, { marginBottom: 8, flex: 1 }]} wrap={false}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
        <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: block.color, marginRight: 5 }} />
        <Text style={[s.categoryLabel, { color: block.color, marginBottom: 0 }]}>{block.label}</Text>
      </View>
      {isEmpty
        ? <Text style={s.emptyText}>No grounded points for this category.</Text>
        : items.map((it, i) => <Bullet key={i} item={it} />)}
    </View>
  );
}

// 2-column wrapping grid of CategoryBlocks -- react-pdf has no CSS grid,
// so pairs are chunked manually into flex rows.
function CategoryGrid({ blocks, data }) {
  const rows = [];
  for (let i = 0; i < blocks.length; i += 2) rows.push(blocks.slice(i, i + 2));
  return (
    <View>
      {rows.map((row, i) => (
        <View key={i} style={[s.row, { gap: 10 }]}>
          {row.map((b) => <CategoryBlock key={b.key} block={b} items={data[b.key]} />)}
          {row.length === 1 && <View style={{ flex: 1 }} />}
        </View>
      ))}
    </View>
  );
}

function KeyTakeawayAndSources({ result }) {
  const takeaway = stripMarketTags(lastSentence(result.text));
  const topCitations = dedupeCitations(result.citations).slice(0, 3);
  return (
    <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLOR.border, flexDirection: "row", gap: 16 }} wrap={false}>
      <View style={{ flex: 1 }}>
        <Text style={[s.categoryLabel, { color: COLOR.amber }]}>Key Takeaway</Text>
        <Text style={{ fontSize: 8.5, color: COLOR.textSecondary, lineHeight: 1.5 }}>{takeaway}</Text>
      </View>
      <View style={{ width: 170 }}>
        <Text style={[s.categoryLabel, { color: COLOR.textMuted }]}>Top Citations</Text>
        {topCitations.map((c, i) => (
          <Text key={i} style={{ fontSize: 7.5, color: COLOR.blue, marginBottom: 2 }}>[{c.index}] {c.source_title || c.source_url}</Text>
        ))}
      </View>
    </View>
  );
}

function FrameworkPageHeader({ label, result, verification }) {
  const verified = verification?.verified ?? false;
  const citeCount = dedupeCitations(result.citations).length;
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
      <View>
        <Text style={s.sectionKicker}>Framework</Text>
        <Text style={s.h1}>{label}</Text>
        <Text style={s.h2sub}>{citeCount} grounded source{citeCount === 1 ? "" : "s"}</Text>
      </View>
      <View style={[s.pill, { backgroundColor: verified ? `${COLOR.teal}1a` : `${COLOR.amber}1a`, color: verified ? COLOR.teal : COLOR.amber }]}>
        <Text>{verified ? "Verified" : "Unverified"}</Text>
      </View>
    </View>
  );
}

function CategoryFrameworkPage({ frameworkKey, label, result, verification, idea }) {
  const { field, blocks } = CATEGORY_FRAMEWORKS[frameworkKey];
  const data = result[field] || {};
  return (
    <Page size="A4" style={s.page}>
      <FrameworkPageHeader label={label} result={result} verification={verification} />
      <CategoryGrid blocks={blocks} data={data} />
      <KeyTakeawayAndSources result={result} />
      <Footer idea={idea} pageLabel={label} />
    </Page>
  );
}

function BalancedScorecardPage({ result, verification, idea }) {
  const data = result.balanced_scorecard || {};
  return (
    <Page size="A4" style={s.page}>
      <FrameworkPageHeader label="Balanced Scorecard" result={result} verification={verification} />
      <CategoryGrid blocks={BALANCED_SCORECARD_BLOCKS} data={data} />
      <KeyTakeawayAndSources result={result} />
      <Footer idea={idea} pageLabel="Balanced Scorecard" />
    </Page>
  );
}

// Real vector redraw of TamSizingCard's nested-circle diagram, including
// the leader-line callout for a ring band too thin to hold its own
// inline label (same MIN_BAND_FOR_INLINE_LABEL fix as the live app's
// SVG version) -- not a screenshot of it.
function TamDiagram({ marketSizing }) {
  const items = marketTiersFromApi(marketSizing);
  const presentItems = items.filter((it) => it.present);
  if (presentItems.length === 0) {
    return <Text style={s.emptyText}>No grounded market-sizing data found.</Text>;
  }
  const maxOuter = 62, minRadius = 16, ringGap = 12;
  const maxValue = Math.max(...presentItems.map((it) => it.value));
  const presentIndices = items.map((it, i) => (it.present ? i : null)).filter((i) => i !== null);
  const radii = new Array(items.length).fill(0);
  let prevRadius = maxOuter + ringGap;
  presentIndices.forEach((idx, rank) => {
    const remainingSmallerTiers = presentIndices.length - 1 - rank;
    const guaranteedFloor = minRadius + ringGap * remainingSmallerTiers;
    const natural = maxOuter * Math.sqrt(items[idx].value / maxValue);
    const ceiling = Math.max(prevRadius - ringGap, guaranteedFloor);
    const r = Math.min(Math.max(natural, guaranteedFloor), ceiling);
    radii[idx] = r;
    prevRadius = r;
  });
  const size = maxOuter * 2 + 12;
  const gutter = 90;
  const cx = size / 2, cy = size / 2;
  const innermostPresentIndex = presentIndices[presentIndices.length - 1];
  const MIN_BAND_FOR_INLINE_LABEL = 15;
  let calloutCount = 0;

  // Single pass per present tier -- each becomes exactly one <G> (a
  // valid SVG group in react-pdf; plain <View> is NOT valid inside
  // <Svg>) holding its circle plus either an inline label or a
  // leader-line callout, never both.
  const tierGroups = items.filter((it) => it.present).map((item) => {
    const i = items.indexOf(item);
    const rankInPresent = presentIndices.indexOf(i);
    const isInnermost = i === innermostPresentIndex;
    const innerBoundary = isInnermost ? 0 : radii[presentIndices[rankInPresent + 1]];
    const bandWidth = isInnermost ? radii[i] : radii[i] - innerBoundary;
    const circle = <Circle cx={cx} cy={cy} r={radii[i]} fill={`${item.color}cc`} stroke={item.color} strokeWidth={1.4} />;

    if (bandWidth >= MIN_BAND_FOR_INLINE_LABEL) {
      const textY = isInnermost ? cy : cy - (radii[i] + innerBoundary) / 2;
      return (
        <G key={item.key}>
          {circle}
          <Text x={cx} y={textY + 2} textAnchor="middle" style={{ fontSize: 6.5, fontWeight: 700, fill: "#ffffff" }}>
            {item.label} {item.displayValue}
          </Text>
        </G>
      );
    }

    const angleDeg = -25 - calloutCount * 35;
    calloutCount += 1;
    const angleRad = (angleDeg * Math.PI) / 180;
    const bandMidR = (radii[i] + innerBoundary) / 2;
    const startX = cx + bandMidR * Math.cos(angleRad);
    const startY = cy - bandMidR * Math.sin(angleRad);
    const endX = cx + (maxOuter + 14) * Math.cos(angleRad);
    const endY = cy - (maxOuter + 14) * Math.sin(angleRad);
    return (
      <G key={item.key}>
        {circle}
        <Line x1={startX} y1={startY} x2={endX} y2={endY} stroke={item.color} strokeWidth={0.8} />
        <Circle cx={startX} cy={startY} r={1.3} fill={item.color} />
        <Text x={endX + 3} y={endY + 2} style={{ fontSize: 6.5, fontWeight: 700, fill: item.color }}>{item.label} {item.displayValue}</Text>
      </G>
    );
  });

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
      <Svg width={size + gutter} height={size} viewBox={`0 0 ${size + gutter} ${size}`}>
        {tierGroups}
      </Svg>
      <View style={{ flex: 1, gap: 6 }}>
        {items.map((item) => (
          <View key={item.key} style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: item.present ? item.color : COLOR.textMuted, marginRight: 6 }} />
            <Text style={{ fontSize: 8, fontWeight: 700, marginRight: 4 }}>{item.label}</Text>
            <Text style={{ fontSize: 8, color: item.present ? COLOR.textSecondary : COLOR.textMuted, fontStyle: item.present ? "normal" : "italic" }}>
              {item.present ? item.displayValue : "No data found"}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TamPage({ result, verification, idea }) {
  return (
    <Page size="A4" style={s.page}>
      <FrameworkPageHeader label="TAM SAM SOM" result={result} verification={verification} />
      <View style={[s.panel, { marginBottom: 10 }]}>
        <TamDiagram marketSizing={result.market_sizing} />
      </View>
      <KeyTakeawayAndSources result={result} />
      <Footer idea={idea} pageLabel="TAM SAM SOM" />
    </Page>
  );
}

function QuadrantChart({ layout, matrix, dims }) {
  if (!matrix) {
    return <Text style={s.emptyText}>The CONTEXT didn't support a grounded quadrant assignment for this framework.</Text>;
  }
  const boxSize = 90, gap = 6;
  return (
    <View style={{ flexDirection: "row", gap: 20 }}>
      <Svg width={boxSize * 2 + gap} height={boxSize * 2 + gap}>
        {layout.map((q, i) => {
          const col = i % 2, row = Math.floor(i / 2);
          const x = col * (boxSize + gap), y = row * (boxSize + gap);
          const isAssigned = q.key === matrix.quadrant;
          return (
            <G key={q.key}>
              <Rect x={x} y={y} width={boxSize} height={boxSize} rx={6}
                fill={isAssigned ? `${q.color}22` : "#ffffff"}
                stroke={isAssigned ? q.color : COLOR.border} strokeWidth={isAssigned ? 1.6 : 1} strokeDasharray={isAssigned ? undefined : "3,3"} />
              <Text x={x + boxSize / 2} y={y + boxSize / 2 + 3} textAnchor="middle"
                style={{ fontSize: 7.5, fontWeight: 700, fill: isAssigned ? q.color : COLOR.textMuted }}>{q.label}</Text>
            </G>
          );
        })}
      </Svg>
      <View style={{ flex: 1, gap: 6, paddingTop: 4 }}>
        {dims.map(([dimLabel, dimValue]) => (
          <Text key={dimLabel} style={{ fontSize: 8.5 }}>
            <Text style={{ fontWeight: 700, color: COLOR.textSecondary }}>{dimLabel}: </Text>
            <Text style={{ color: COLOR.textPrimary }}>{dimValue}</Text>
          </Text>
        ))}
        <Text style={{ fontSize: 8.5, color: COLOR.textSecondary, lineHeight: 1.5, marginTop: 4 }}>
          {matrix.rationale}
          {matrix.citation_index != null && <Text style={s.citeMark}> [{matrix.citation_index}]</Text>}
        </Text>
      </View>
    </View>
  );
}

function BcgPage({ result, verification, idea }) {
  const m = result.bcg_matrix;
  return (
    <Page size="A4" style={s.page}>
      <FrameworkPageHeader label="BCG Matrix" result={result} verification={verification} />
      <View style={[s.panel, { marginBottom: 10 }]}>
        <QuadrantChart layout={BCG_QUADRANT_LAYOUT} matrix={m} dims={m ? [["Market growth", `${m.market_growth_rate_pct}%`], ["Market position", m.market_share_position]] : []} />
      </View>
      <KeyTakeawayAndSources result={result} />
      <Footer idea={idea} pageLabel="BCG Matrix" />
    </Page>
  );
}

function AnsoffPage({ result, verification, idea }) {
  const m = result.ansoff_matrix;
  return (
    <Page size="A4" style={s.page}>
      <FrameworkPageHeader label="Ansoff Matrix" result={result} verification={verification} />
      <View style={[s.panel, { marginBottom: 10 }]}>
        <QuadrantChart layout={ANSOFF_QUADRANT_LAYOUT} matrix={m} dims={m ? [["Market", m.market_dimension], ["Product", m.product_dimension]] : []} />
      </View>
      <KeyTakeawayAndSources result={result} />
      <Footer idea={idea} pageLabel="Ansoff Matrix" />
    </Page>
  );
}

function ConfidenceRing({ pct, tone, size = 76 }) {
  const r = size / 2 - 6;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;
  const color = ToneColor(tone);
  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cy} r={r} stroke={COLOR.border} strokeWidth={6} fill="none" />
      <Circle cx={cx} cy={cy} r={r} stroke={color} strokeWidth={6} fill="none"
        strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} />
      <Text x={cx} y={cy + 4} textAnchor="middle" style={{ fontSize: 14, fontWeight: 700, fill: COLOR.textPrimary }}>{pct}%</Text>
    </Svg>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <View style={[s.panel, { flex: 1 }]}>
      <Text style={{ fontSize: 7.5, color: COLOR.textMuted, marginBottom: 3 }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: 700, color: COLOR.textPrimary }}>{value}</Text>
      <Text style={{ fontSize: 7, color: COLOR.textMuted, marginTop: 2 }}>{sub}</Text>
    </View>
  );
}

function BusinessMetricCard({ meta, metric, report }) {
  if (!metric) {
    return (
      <View style={[s.panel, { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 62 }]}>
        <Text style={{ fontSize: 7, color: COLOR.textMuted, textAlign: "center" }}>{meta.label}</Text>
        <Text style={{ fontSize: 6.5, color: COLOR.textMuted, textAlign: "center", marginTop: 2 }}>Not enough data</Text>
      </View>
    );
  }
  const score = computeEvidenceScore(metric, report);
  const tone = score == null ? null : score >= 7 ? "teal" : score >= 4 ? "amber" : "red";
  const color = tone ? ToneColor(tone) : COLOR.blue;
  return (
    <View style={[s.panel, { flex: 1 }]}>
      <Text style={{ fontSize: 7, color: COLOR.textMuted, marginBottom: 2 }}>{meta.label}</Text>
      <Text style={{ fontSize: 10.5, fontWeight: 700, color: COLOR.textPrimary, marginBottom: 3 }}>{metric.label}</Text>
      <Text style={{ fontSize: 6.5, color: COLOR.textSecondary, lineHeight: 1.4 }}>{metric.rationale}</Text>
      {score != null && (
        <Text style={{ fontSize: 6.5, fontWeight: 700, color, marginTop: 4 }}>{score.toFixed(1)}/10</Text>
      )}
    </View>
  );
}

function ExecutiveSummaryPage({ report, stats, idea }) {
  const verdictColor = ToneColor(stats.tone);
  return (
    <Page size="A4" style={s.page}>
      <Text style={s.sectionKicker}>Executive Summary</Text>
      <View style={[s.panel, { flexDirection: "row", alignItems: "center", marginBottom: 14, borderColor: verdictColor, borderWidth: 1.4, backgroundColor: `${verdictColor}0d` }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 8, fontWeight: 700, color: verdictColor, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>Overall Strategic Verdict</Text>
          <Text style={{ fontSize: 15, fontWeight: 700, color: verdictColor, marginBottom: 4 }}>{stats.verdict}</Text>
          <Text style={{ fontSize: 8, color: COLOR.textSecondary }}>{stats.verdictSub}</Text>
        </View>
        <ConfidenceRing pct={stats.totalFrameworks ? Math.round((stats.verifiedCount / stats.totalFrameworks) * 100) : 0} tone={stats.tone} />
      </View>

      <View style={[s.row, { gap: 8, marginBottom: 14 }]}>
        <StatCard label="Frameworks Verified" value={`${stats.verifiedCount}/${stats.totalFrameworks}`} sub="Passed citation check" />
        <StatCard label="Grounded Sources" value={stats.totalCitations} sub="Unique citations used" />
        <StatCard label="Avg Source Match" value={`${stats.avgSimilarity}%`} sub="Semantic similarity" />
        <StatCard label="Unverified Sections" value={stats.unverifiedCount} sub={stats.unverifiedCount > 0 ? "Needs more sources" : "All clear"} />
      </View>

      <Text style={[s.categoryLabel, { color: COLOR.textMuted, marginBottom: 6 }]}>Business Judgment Cards</Text>
      <View style={[s.row, { gap: 8 }]}>
        {BUSINESS_METRIC_CARDS.map((meta) => (
          <BusinessMetricCard key={meta.key} meta={meta} metric={report.business_metrics?.[meta.key]} report={report} />
        ))}
      </View>

      <Footer idea={idea} pageLabel="Executive Summary" />
    </Page>
  );
}

function CoverPage({ idea, title, today, frameworkCount }) {
  return (
    <Page size="A4" style={s.coverPage}>
      <BrandRow />
      <Text style={s.kicker}>Full Business Analysis Report</Text>
      <Text style={s.coverTitle}>{idea || title}</Text>
      <Text style={s.coverMeta}>{today} &middot; v1.0 (Latest) &middot; {frameworkCount} framework{frameworkCount === 1 ? "" : "s"} analyzed</Text>
      <View style={{ position: "absolute", bottom: 60, left: 56, right: 56, borderTopWidth: 1, borderTopColor: COLOR.border, paddingTop: 10 }}>
        <Text style={{ fontSize: 7.5, color: COLOR.textMuted }}>
          Every claim in this report is grounded in a real, cited source retrieved for this specific idea -- see each section's own citations and the Sources &amp; Citations appendix.
        </Text>
      </View>
    </Page>
  );
}

function SourcesPage({ report, idea }) {
  const allCitations = Object.entries(report.results || {}).flatMap(([fw, r]) => (r.citations || []).map((c) => ({ ...c, _framework: fw })));
  const deduped = dedupeCitations(allCitations);
  return (
    <Page size="A4" style={s.page}>
      <Text style={s.sectionKicker}>Sources &amp; Citations</Text>
      <Text style={s.h1}>All Sources ({deduped.length})</Text>
      <Text style={s.h2sub}>Every source retrieved and cited across every framework in this report.</Text>
      <View style={{ marginTop: 6 }}>
        {deduped.map((c, i) => (
          <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: COLOR.border }} wrap={false}>
            <Text style={{ fontSize: 8, color: COLOR.textPrimary, flex: 1, marginRight: 8 }}>{c.source_title || c.source_url}</Text>
            <Text style={{ fontSize: 7.5, color: COLOR.textMuted }}>{Math.round(c.similarity * 100)}%</Text>
          </View>
        ))}
      </View>
      <Footer idea={idea} pageLabel="Sources & Citations" />
    </Page>
  );
}

// key -> page component -- SIDEBAR_FRAMEWORK_NAV order (ReportView.jsx)
// is passed in by the caller so this file doesn't need its own copy of
// the sidebar's full label/icon/color metadata, just the render dispatch.
export function ReportPdfDocument({ report, idea, title, today, frameworkOrder }) {
  const stats = computeStats(report);
  const present = frameworkOrder.filter((item) => report.results?.[item.key]);

  return (
    <Document title={`Groundly Analysis - ${idea || title}`} author="Groundly">
      <CoverPage idea={idea} title={title} today={today} frameworkCount={present.length} />
      <ExecutiveSummaryPage report={report} stats={stats} idea={idea} />
      {present.map((item) => {
        const result = report.results[item.key];
        const verification = report.verification?.[item.key];
        if (CATEGORY_FRAMEWORKS[item.key]) {
          return <CategoryFrameworkPage key={item.key} frameworkKey={item.key} label={item.label} result={result} verification={verification} idea={idea} />;
        }
        if (item.key === "balanced_scorecard") return <BalancedScorecardPage key={item.key} result={result} verification={verification} idea={idea} />;
        if (item.key === "tam") return <TamPage key={item.key} result={result} verification={verification} idea={idea} />;
        if (item.key === "bcg") return <BcgPage key={item.key} result={result} verification={verification} idea={idea} />;
        if (item.key === "ansoff") return <AnsoffPage key={item.key} result={result} verification={verification} idea={idea} />;
        return null;
      })}
      <SourcesPage report={report} idea={idea} />
    </Document>
  );
}

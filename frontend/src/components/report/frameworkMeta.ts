import {
  BarChart2,
  Gauge,
  Globe,
  Grid2X2,
  Grid3X3,
  Layers,
  Link2,
  Shield,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

export const FRAMEWORK_NAV_ITEMS = [
  { key: "pestel", label: "PESTEL", shortLabel: "PESTEL", icon: Globe, color: "#4a8fff" },
  { key: "porter", label: "Porter's Five Forces", shortLabel: "Porter's 5 Forces", icon: Shield, color: "#f05252" },
  { key: "swot", label: "SWOT", shortLabel: "SWOT", icon: Grid3X3, color: "#818cf8" },
  { key: "tam", label: "TAM SAM SOM", shortLabel: "TAM SAM SOM", icon: Target, color: "#14d8a3" },
  { key: "stp", label: "STP", shortLabel: "STP", icon: Users, color: "#38bdf8" },
  { key: "bcg", label: "BCG Matrix", shortLabel: "BCG Matrix", icon: Grid2X2, color: "#f5b041" },
  { key: "ansoff", label: "Ansoff Matrix", shortLabel: "Ansoff Matrix", icon: TrendingUp, color: "#14d8a3" },
  { key: "value_chain", label: "Value Chain", shortLabel: "Value Chain", icon: Link2, color: "#f05252" },
  { key: "bmc", label: "Business Model Canvas", shortLabel: "Business Model", icon: Layers, color: "#f5b041" },
  { key: "balanced_scorecard", label: "Balanced Scorecard", shortLabel: "Balanced Score", icon: Gauge, color: "#60a5fa" },
] as const;

export const FRAMEWORK_LABELS: Record<string, string> = Object.fromEntries(
  FRAMEWORK_NAV_ITEMS.map((item) => [item.key, item.label]),
);

export const BUSINESS_METRIC_CARDS = [
  {
    key: "market_size",
    label: "Market Size",
    targetFramework: "tam",
    icon: BarChart2,
    accent: "#14d8a3",
  },
  {
    key: "competitive_pressure",
    label: "Competitive Pressure",
    targetFramework: "porter",
    icon: Shield,
    accent: "#f05252",
  },
  {
    key: "customer_segment",
    label: "Best Customer Segment",
    targetFramework: "stp",
    icon: Users,
    accent: "#4a8fff",
  },
  {
    key: "business_model_fit",
    label: "Business Model Fit",
    targetFramework: "bmc",
    icon: Layers,
    accent: "#818cf8",
  },
  {
    key: "risk_flags",
    label: "Risk Flags",
    targetFramework: "swot",
    icon: Target,
    accent: "#f5b041",
  },
] as const;

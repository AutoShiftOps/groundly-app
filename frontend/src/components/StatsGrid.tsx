import { useState } from "react";
import { Lock, Search, Globe, BarChart2, Lightbulb, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

const SPARK_UP = [2, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8].map((v) => ({ v }));
const SPARK_FLAT = [5, 6, 5, 7, 6, 7, 6, 8, 7, 8, 7, 9].map((v) => ({ v }));
const PRO_TIPS = [
    "TAM measures your total addressable market.",
    "SAM is your serviceable addressable market.",
    "SOM is your obtainable market share.",
    "Validate assumptions early with customer interviews.",
];

export default function StatsGrid({ activeIndex, sourceCount }: { activeIndex: number, sourceCount: number }) {
    const [tipIdx, setTipIdx] = useState(0);

    const sourceMetric = activeIndex >= 1 ? (sourceCount > 0 ? sourceCount : 47 + activeIndex * 10) : 0;
    const marketsMetric = activeIndex >= 2 ? 8 : 0;
    const dataPointsMetric = activeIndex >= 3 ? 328 + activeIndex * 50 : 0;

    return (
        <div className="px-8 pb-4 flex flex-col gap-6">
            <div className="flex gap-3 flex-wrap">
                <Card className="flex-1 min-w-[185px] border-[rgba(99,140,255,0.13)] bg-[rgba(10,20,40,0.92)] shadow-[0_4px_28px_rgba(0,0,0,0.35)]">
                    <CardContent className="p-4 flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[rgba(74,143,255,0.18)]">
                                <Search size={18} className="text-[#4a8fff]" strokeWidth={1.8} />
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[26px] font-bold text-white leading-none">{sourceMetric}</span>
                                <span className="text-xs font-medium text-[#7a8aaa]">sources scanned</span>
                                <span className="text-[11px] text-[#4a8fff] mt-0.5 leading-tight">+12 in the last 30s</span>
                            </div>
                        </div>
                        <div className="flex justify-end"><div style={{ width: 96, height: 40 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={SPARK_UP} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}><defs><linearGradient id="sg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4a8fff" stopOpacity={0.3} /><stop offset="100%" stopColor="#4a8fff" stopOpacity={0} /></linearGradient></defs><Area type="monotone" dataKey="v" stroke="#4a8fff" strokeWidth={1.5} fill="url(#sg1)" dot={false} /></AreaChart></ResponsiveContainer></div></div>
                    </CardContent>
                </Card>

                <Card className="flex-1 min-w-[185px] border-[rgba(99,140,255,0.13)] bg-[rgba(10,20,40,0.92)] shadow-[0_4px_28px_rgba(0,0,0,0.35)]">
                    <CardContent className="p-4 flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[rgba(45,212,191,0.15)]">
                                <Globe size={18} className="text-[#2dd4bf]" strokeWidth={1.8} />
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[26px] font-bold text-white leading-none">{marketsMetric}</span>
                                <span className="text-xs font-medium text-[#7a8aaa]">markets analyzed</span>
                                <span className="text-[11px] text-[#7a8aaa] mt-0.5 leading-tight">US, UK, IN, DE, CA...</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="flex-1 min-w-[185px] border-[rgba(99,140,255,0.13)] bg-[rgba(10,20,40,0.92)] shadow-[0_4px_28px_rgba(0,0,0,0.35)]">
                    <CardContent className="p-4 flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[rgba(167,139,250,0.18)]">
                                <BarChart2 size={18} className="text-[#a78bfa]" strokeWidth={1.8} />
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[26px] font-bold text-white leading-none">{dataPointsMetric}</span>
                                <span className="text-xs font-medium text-[#7a8aaa]">data points processed</span>
                                <span className="text-[11px] text-[#7a8aaa] mt-0.5 leading-tight">Crunching numbers for deeper insights</span>
                            </div>
                        </div>
                        <div className="flex justify-end"><div style={{ width: 96, height: 40 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={SPARK_FLAT} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}><defs><linearGradient id="sg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} /><stop offset="100%" stopColor="#a78bfa" stopOpacity={0} /></linearGradient></defs><Area type="monotone" dataKey="v" stroke="#a78bfa" strokeWidth={1.5} fill="url(#sg2)" dot={false} /></AreaChart></ResponsiveContainer></div></div>
                    </CardContent>
                </Card>

                <Card className="flex-1 min-w-[185px] border-[rgba(99,140,255,0.13)] bg-[rgba(10,20,40,0.92)] shadow-[0_4px_28px_rgba(0,0,0,0.35)]">
                    <CardContent className="p-4 flex flex-col gap-3 h-full">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[rgba(124,58,237,0.25)]">
                                <Lightbulb size={18} className="text-[#a78bfa]" strokeWidth={1.8} />
                            </div>
                            <div className="flex flex-col gap-1 flex-1 min-w-0">
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#a78bfa]">Pro Tip</span>
                                <p className="text-sm font-medium text-white leading-snug">{PRO_TIPS[tipIdx]}</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-between mt-auto pt-3">
                            <button onClick={() => setTipIdx((i) => (i - 1 + PRO_TIPS.length) % PRO_TIPS.length)} className="text-[#7a8aaa] hover:text-white transition-colors p-1"><ChevronLeft size={16} /></button>
                            <div className="flex gap-1.5">
                                {PRO_TIPS.map((_, i) => (
                                    <button key={i} onClick={() => setTipIdx(i)} className="rounded-full transition-all duration-200" style={{ width: i === tipIdx ? 16 : 6, height: 6, background: i === tipIdx ? "#4a8fff" : "rgba(255,255,255,0.2)" }} />
                                ))}
                            </div>
                            <button onClick={() => setTipIdx((i) => (i + 1) % PRO_TIPS.length)} className="text-[#7a8aaa] hover:text-white transition-colors p-1"><ChevronRight size={16} /></button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex items-center justify-center gap-2 py-1 text-[#5a6a8a] text-xs">
                <Lock size={12} strokeWidth={2} />
                <span>Your data is encrypted and secure</span>
            </div>
        </div>
    );
}
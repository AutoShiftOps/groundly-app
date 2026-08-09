import { CheckCircle2, FlaskConical, MoreHorizontal } from "lucide-react";

function SmokeColumn({ active }: { active: boolean }) {
    if (!active) return null;
    const wisps = [
        { d: "2.1s", dl: "0s", dx: "3px", sz: 9, l: "22%" },
        { d: "2.6s", dl: "0.55s", dx: "-4px", sz: 7, l: "45%" },
        { d: "1.9s", dl: "1.1s", dx: "5px", sz: 8, l: "62%" },
        { d: "2.4s", dl: "0.3s", dx: "-2px", sz: 6, l: "78%" },
    ];
    return (
        <div className="absolute w-full pointer-events-none" style={{ bottom: "100%", height: 48, left: 0 }}>
            {wisps.map((w, i) => (
                <div
                    key={i}
                    className="smoke-p absolute rounded-full"
                    style={{
                        left: w.l, bottom: 0, width: w.sz, height: w.sz,
                        background: `rgba(245,158,11,0.55)`,
                        filter: "blur(3px)",
                        "--d": w.d, "--dl": w.dl, "--dx": w.dx,
                    } as React.CSSProperties}
                />
            ))}
        </div>
    );
}

function TrainWheel({ color, spin = false }: { color: string; spin?: boolean }) {
    return (
        <div
            className={`relative flex items-center justify-center rounded-full border-[2.5px] ${spin ? "wheel-spin" : ""}`}
            style={{
                width: 22, height: 22, borderColor: color,
                background: "radial-gradient(circle, #0a1420 60%, #060e1a 100%)",
                boxShadow: `0 0 6px rgba(${color === "#f59e0b" ? "245,158,11" : "45,212,191"},0.6)`,
            }}
        >
            <div className="absolute rounded-full" style={{ width: 7, height: 7, background: color, opacity: 0.8 }} />
            {[0, 60, 120].map((deg) => (
                <div key={deg} className="absolute" style={{ width: 1, height: "70%", background: color, opacity: 0.5, transform: `rotate(${deg}deg)`, transformOrigin: "center" }} />
            ))}
        </div>
    );
}

export default function TrainCar({ stage, activeIndex }: { stage: { label: string, index: number }, activeIndex: number }) {
    const done = stage.index < activeIndex;
    const active = stage.index === activeIndex;
    const pending = stage.index > activeIndex;

    const tc = done ? { rgb: "45,212,191", hex: "#2dd4bf", label: "#2dd4bf" }
        : active ? { rgb: "245,158,11", hex: "#f59e0b", label: "#fbbf24" }
            : { rgb: "120,140,180", hex: "rgba(255,255,255,0.18)", label: "#3a4e6a" };

    const faceBg = done ? "linear-gradient(160deg, rgba(45,212,191,0.2) 0%, rgba(45,212,191,0.07) 60%, rgba(0,0,0,0.15) 100%)"
        : active ? "linear-gradient(160deg, rgba(245,158,11,0.22) 0%, rgba(245,158,11,0.08) 60%, rgba(0,0,0,0.2) 100%)"
            : "linear-gradient(160deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)";

    return (
        <div className="relative flex flex-col items-center select-none">
            <SmokeColumn active={active} />

            {/* Carriage Face */}
            <div
                className={`relative flex items-center gap-3 px-5 rounded-[18px] ${active ? "amber-pulse" : ""}`}
                style={{
                    width: 158, height: 80, background: faceBg,
                    border: `2px solid ${tc.hex}`,
                    boxShadow: active ? undefined : done ? `0 0 12px 2px rgba(${tc.rgb},0.95), 0 0 30px 6px rgba(${tc.rgb},0.6), 0 0 70px 16px rgba(${tc.rgb},0.3), 0 0 130px 30px rgba(${tc.rgb},0.12), inset 0 0 18px rgba(${tc.rgb},0.12)` : "none",
                }}
            >
                <div className="absolute top-0 left-6 right-6 h-px rounded-full" style={{ background: `rgba(${tc.rgb},0.5)` }} />
                <div className="absolute inset-0 rounded-[16px] pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 50%)" }} />
                <div className="relative z-10 flex items-center justify-center rounded-full border-2 shrink-0" style={{ width: 38, height: 38, borderColor: tc.hex, background: `rgba(${tc.rgb},0.12)`, boxShadow: pending ? "none" : `0 0 10px rgba(${tc.rgb},0.6)` }}>
                    {done && <CheckCircle2 size={18} style={{ color: tc.hex }} strokeWidth={2.5} />}
                    {active && <FlaskConical size={18} style={{ color: tc.hex }} strokeWidth={2} />}
                    {pending && <MoreHorizontal size={18} style={{ color: tc.label }} />}
                </div>
                <span className="relative z-10 text-[14px] font-bold tracking-wide" style={{ color: tc.label }}>
                    {stage.label}
                </span>
            </div>

            {/* Undercarriage & Wheels */}
            <div style={{ width: 140, height: 14, marginTop: -2, background: done ? "linear-gradient(180deg, rgba(45,212,191,0.18) 0%, rgba(0,0,0,0.5) 100%)" : active ? "linear-gradient(180deg, rgba(245,158,11,0.18) 0%, rgba(0,0,0,0.5) 100%)" : "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.5) 100%)", border: `2px solid ${tc.hex}`, borderTop: "none", borderRadius: "0 0 6px 6px" }} />
            <div style={{ width: 130, height: 4, marginTop: 1, background: pending ? "rgba(255,255,255,0.05)" : `linear-gradient(90deg, rgba(${tc.rgb},0.0) 0%, rgba(${tc.rgb},0.4) 30%, rgba(${tc.rgb},0.4) 70%, rgba(${tc.rgb},0.0) 100%)` }} />
            <div className="flex justify-between mt-[3px]" style={{ width: 134 }}>
                {[0, 1, 2, 3].map((i) => (
                    <TrainWheel key={i} color={tc.hex} spin={active} />
                ))}
            </div>
        </div>
    );
}
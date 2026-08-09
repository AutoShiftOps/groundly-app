import TrainCar from "./TrainCar";

const STAGES = ["Ideating", "Researching", "Prototyping", "Testing", "Finalizing"];

export default function PipelineTrack({ activeIndex }: { activeIndex: number }) {
    return (
        <div
            className="relative overflow-hidden"
            style={{
                minHeight: 280, padding: "44px 32px 0",
                background: [
                    "radial-gradient(ellipse 65% 55% at 32% 58%, rgba(45,212,191,0.07) 0%, transparent 65%)",
                    "radial-gradient(ellipse 35% 40% at 64% 52%, rgba(245,158,11,0.06) 0%, transparent 60%)",
                ].join(", "),
            }}
        >
            {/* Ground Atmospheric Glow */}
            <div className="absolute pointer-events-none" style={{ bottom: 30, left: "5%", right: "25%", height: 80, background: "radial-gradient(ellipse 80% 100% at 40% 100%, rgba(45,212,191,0.14) 0%, transparent 70%)", filter: "blur(12px)" }} />
            <div className="absolute pointer-events-none" style={{ bottom: 30, left: "48%", right: "5%", height: 80, background: "radial-gradient(ellipse 60% 100% at 55% 100%, rgba(245,158,11,0.1) 0%, transparent 70%)", filter: "blur(16px)" }} />

            {/* Train Carriages Row */}
            <div className="relative z-10 flex items-end">
                {STAGES.map((label, i) => (
                    <div key={label} className="flex items-end">
                        <TrainCar stage={{ label, index: i }} activeIndex={activeIndex} />
                        {i < STAGES.length - 1 && (
                            <div className="flex items-center self-end mb-[28px] mx-[-3px]" style={{ width: 18 }}>
                                <div className="w-full h-px" style={{ background: i < activeIndex ? "rgba(45,212,191,0.55)" : "rgba(255,255,255,0.12)" }} />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Steel Rails & Track */}
            <div className="relative z-10">
                <div className="relative flex justify-evenly px-2" style={{ height: 12 }}>
                    {Array.from({ length: 22 }).map((_, i) => (
                        <div key={i} className="rounded-sm" style={{ width: 3, height: 12, background: "rgba(80,110,160,0.25)" }} />
                    ))}
                </div>
                <div className="rail-shimmer w-full rounded-full" style={{ height: 4, marginTop: -2, background: "linear-gradient(90deg, rgba(45,212,191,1) 0%, rgba(74,143,255,0.8) 58%, rgba(255,255,255,0.1) 100%)", boxShadow: "0 0 10px 2px rgba(45,212,191,0.75), 0 0 24px 4px rgba(45,212,191,0.35)" }} />
                <div style={{ height: 6 }} />
                <div className="w-full rounded-full" style={{ height: 2.5, background: "linear-gradient(90deg, rgba(45,212,191,0.65) 0%, rgba(74,143,255,0.45) 58%, rgba(255,255,255,0.05) 100%)", boxShadow: "0 0 6px rgba(45,212,191,0.4)" }} />
                <div style={{ height: 50, marginTop: 2, background: "linear-gradient(180deg, rgba(45,212,191,0.18) 0%, rgba(45,212,191,0.07) 35%, transparent 100%)", filter: "blur(2px)" }} />
            </div>
        </div>
    );
}
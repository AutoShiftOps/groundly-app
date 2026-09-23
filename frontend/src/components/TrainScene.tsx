const POD = {
  done: "/train/pod-green.png",
  active: "/train/pod-gold.png",
  pending: "/train/pod-blue.png",
} as const;

type Status = "done" | "active" | "pending";

export const STAGE_LABELS = ["Ideating", "Researching", "Prototyping", "Testing", "Finalizing"];

const statusFor = (i: number, active: number): Status =>
  i < active ? "done" : i === active ? "active" : "pending";

export default function TrainScene({ activeStageIndex }: { activeStageIndex: number }) {
  const active = activeStageIndex < 0 ? -1 : Math.max(0, Math.min(STAGE_LABELS.length - 1, activeStageIndex));

  return (
    <div
      className="pod-scene"
      role="img"
      aria-label={`Analysis pipeline. Current stage: ${active < 0 ? "idle" : STAGE_LABELS[active]}.`}
    >
      <div className="pod-floor" />
      <div className="pod-rails" aria-hidden="true">
        <span className="pod-rail pod-rail-a" />
        <span className="pod-rail pod-rail-b" />
      </div>
      <div className="pod-row">
        {STAGE_LABELS.map((label, i) => {
          const status = statusFor(i, active);
          return (
            <figure key={label} className={`pod pod-${status}`}>
              <img src={POD[status]} alt="" />
              <figcaption>{label}</figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

import TrainScene from "./TrainScene";
import { stageIndexFromProgress } from "@/lib/analysis/types";

export function AnalysisTrain({
  progress,
  compact = false,
}: {
  progress: number;
  compact?: boolean;
}) {
  const active = progress < 0 ? -1 : stageIndexFromProgress(progress);
  return (
    <div className={compact ? "train-stage train-stage-compact" : "train-stage"}>
      <TrainScene activeStageIndex={active} />
    </div>
  );
}

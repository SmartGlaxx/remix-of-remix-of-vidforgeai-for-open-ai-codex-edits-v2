import { motion } from "framer-motion";
import {
  Type, FileText, Mic, Image, Palette, Music, Film, Check, Lock,
} from "lucide-react";

export const pipelineSteps = [
  { id: "title", label: "Title", icon: Type, desc: "Generate viral titles" },
  { id: "script", label: "Script", icon: FileText, desc: "AI scriptwriting" },
  { id: "voiceover", label: "Voice", icon: Mic, desc: "Text to speech" },
  { id: "visuals", label: "Visuals", icon: Image, desc: "Scene generation" },
  { id: "thumbnail", label: "Thumb", icon: Palette, desc: "Click-worthy art" },
  { id: "soundtrack", label: "Music", icon: Music, desc: "Background audio" },
  { id: "video", label: "Export", icon: Film, desc: "Final render" },
];

interface PipelineTabsProps {
  activeStep: string;
  onStepChange: (id: string) => void;
  completedSteps: string[];
}

const PipelineTabs = ({ activeStep, onStepChange, completedSteps }: PipelineTabsProps) => {
  const activeIndex = pipelineSteps.findIndex((s) => s.id === activeStep);

  return (
    <div className="border-b border-border bg-card/40 backdrop-blur-sm">
      <div className="flex items-center px-2">
        {pipelineSteps.map((step, i) => {
          const isActive = step.id === activeStep;
          const isComplete = completedSteps.includes(step.id);
          const isPast = i < activeIndex;
          const isFuture = i > activeIndex && !isComplete;

          return (
            <div key={step.id} className="flex items-center flex-1 min-w-0">
              <button
                onClick={() => onStepChange(step.id)}
                className="relative flex-1 group py-1"
              >
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-medium transition-colors relative ${
                    isActive
                      ? "text-primary"
                      : isComplete
                      ? "text-emerald-400"
                      : isPast
                      ? "text-primary/60"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeStepBg"
                      className="absolute inset-0 bg-primary/8 border border-primary/20 rounded-xl"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <div className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary/20"
                      : isComplete
                      ? "bg-emerald-500/15"
                      : "bg-muted/50"
                  }`}>
                    {isComplete ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : isFuture ? (
                      <Lock className="w-3 h-3 text-muted-foreground/50" />
                    ) : (
                      <step.icon className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <span className="relative z-10 text-xs font-semibold truncate">{step.label}</span>
                </motion.div>

                {/* Active indicator line */}
                {isActive && (
                  <motion.div
                    layoutId="activeTabLine"
                    className="absolute bottom-0 left-3 right-3 h-0.5 bg-primary rounded-full"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
              {i < pipelineSteps.length - 1 && (
                <div className={`w-4 h-px flex-shrink-0 transition-colors ${isComplete || isPast ? "bg-primary/30" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-border/50">
        <motion.div
          className="h-full bg-gradient-to-r from-primary to-accent"
          initial={false}
          animate={{ width: `${((activeIndex + 1) / pipelineSteps.length) * 100}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      </div>
    </div>
  );
};

export default PipelineTabs;

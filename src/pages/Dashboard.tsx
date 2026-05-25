import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ArrowLeft, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import Sidebar from "@/components/dashboard/Sidebar";
import PipelineTabs, { pipelineSteps } from "@/components/dashboard/PipelineTabs";
import TitleStep from "@/components/dashboard/steps/TitleStep";
import ScriptStep from "@/components/dashboard/steps/ScriptStep";
import VoiceoverStep from "@/components/dashboard/steps/VoiceoverStep";
import VisualsStep from "@/components/dashboard/steps/VisualsStep";
import ThumbnailStep from "@/components/dashboard/steps/ThumbnailStep";
import SoundtrackStep from "@/components/dashboard/steps/SoundtrackStep";
import VideoStep from "@/components/dashboard/steps/VideoStep";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { useProject } from "@/contexts/ProjectContext";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const stepComponents: Record<string, React.FC> = {
  title: TitleStep,
  script: ScriptStep,
  voiceover: VoiceoverStep,
  visuals: VisualsStep,
  thumbnail: ThumbnailStep,
  soundtrack: SoundtrackStep,
  video: VideoStep,
};

const ResetButton = () => {
  const { resetProject } = useProject();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2 border-border/60 hover:border-destructive/40 hover:text-destructive">
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Project
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Start a clean slate?</AlertDialogTitle>
          <AlertDialogDescription>
            This clears every step — titles, script, voiceover, visuals, thumbnail,
            soundtrack and final video — used or not. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              resetProject();
              toast.success("Project reset. Fresh start ready.");
            }}
          >
            Reset everything
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const DashboardInner = () => {
  const [activeStep, setActiveStep] = useState("title");
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [direction, setDirection] = useState(1);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const ActiveStepComponent = stepComponents[activeStep];
  const { resetNonce } = useProject();

  // When the project is reset, also reset navigation state and force
  // step components to remount so their local state (visuals, thumbnails,
  // suggestions, etc.) is wiped clean.
  useState(() => 0); // no-op to keep hook order
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffectOnReset(resetNonce, () => {
    setActiveStep("title");
    setCompletedSteps([]);
    setDirection(1);
  });

  const handleStepChange = (newStep: string) => {
    const oldIdx = pipelineSteps.findIndex((s) => s.id === activeStep);
    const newIdx = pipelineSteps.findIndex((s) => s.id === newStep);
    setDirection(newIdx > oldIdx ? 1 : -1);
    setActiveStep(newStep);
  };

  const handleContinue = () => {
    const idx = pipelineSteps.findIndex((s) => s.id === activeStep);
    if (idx < pipelineSteps.length - 1) {
      setCompletedSteps((prev) => [...new Set([...prev, activeStep])]);
      setDirection(1);
      setActiveStep(pipelineSteps[idx + 1].id);
    }
  };

  const handleBack = () => {
    const idx = pipelineSteps.findIndex((s) => s.id === activeStep);
    if (idx > 0) {
      setDirection(-1);
      setActiveStep(pipelineSteps[idx - 1].id);
    }
  };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar activePage="create" collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(v => !v)} />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top toolbar */}
        <div className="border-b border-border/60 px-4 py-2 flex items-center justify-end gap-2 bg-card/20 backdrop-blur-sm">
          <ResetButton />
        </div>

        {/* Pipeline */}
        <PipelineTabs
          activeStep={activeStep}
          onStepChange={handleStepChange}
          completedSteps={completedSteps}
        />

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={`${activeStep}-${resetNonce}`}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <ActiveStepComponent />
              </motion.div>
            </AnimatePresence>

            {(() => {
              const idx = pipelineSteps.findIndex((s) => s.id === activeStep);
              const isLast = idx === pipelineSteps.length - 1;
              return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center justify-between mt-8 pt-6 border-t border-border"
              >
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  disabled={idx === 0}
                  className="h-10 px-4 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                {!isLast && (
                  <Button onClick={handleContinue} className="glow-sm h-10 px-6">
                    Continue to {pipelineSteps[idx + 1]?.label}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </motion.div>
              );
            })()}
          </div>
        </div>
      </main>
    </div>
  );
};

const Dashboard = () => (
  <ProjectProvider>
    <DashboardInner />
  </ProjectProvider>
);

export default Dashboard;

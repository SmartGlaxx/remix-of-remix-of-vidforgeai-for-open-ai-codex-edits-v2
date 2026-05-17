import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ArrowLeft, Menu, Settings, HelpCircle,
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

const stepComponents: Record<string, React.FC> = {
  title: TitleStep,
  script: ScriptStep,
  voiceover: VoiceoverStep,
  visuals: VisualsStep,
  thumbnail: ThumbnailStep,
  soundtrack: SoundtrackStep,
  video: VideoStep,
};

const Dashboard = () => {
  const [activeStep, setActiveStep] = useState("title");
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [direction, setDirection] = useState(1);
  const ActiveStepComponent = stepComponents[activeStep];

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
    <ProjectProvider>
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar activePage="create" />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-border px-5 py-3.5 bg-card/30 backdrop-blur-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="lg:hidden w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
              <Menu className="w-4 h-4 text-muted-foreground" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-base font-bold text-foreground">New Project</h1>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-primary/15 text-primary border border-primary/20">Draft</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Create your next viral video • Auto-saved 2s ago</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <HelpCircle className="w-4 h-4" />
            </button>
            <button className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

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
                key={activeStep}
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
    </ProjectProvider>
  );
};

export default Dashboard;

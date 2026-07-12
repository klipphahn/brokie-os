"use client";
import { CheckCircle2, CircleDashed, LoaderCircle, XCircle } from "lucide-react";

export default function JobQueue({ stages = [], running = false }) {
  if (!stages.length) return null;
  return (
    <div className="jobQueue">
      <div className="jobQueueHead">
        <div><span className="eyebrow">JOB QUEUE</span><strong>{running ? "Generation in progress" : "Latest generation"}</strong></div>
        <span className={running ? "queueRunning" : "queueDone"}>{running ? "RUNNING" : "COMPLETE"}</span>
      </div>
      <div className="jobSteps">
        {stages.map((stage, index) => (
          <div className={`jobStep ${stage.status}`} key={`${stage.label}-${index}`}>
            {stage.status === "done" ? <CheckCircle2 size={17}/> : stage.status === "error" ? <XCircle size={17}/> : stage.status === "active" ? <LoaderCircle className="spin" size={17}/> : <CircleDashed size={17}/>} 
            <span><b>{String(index + 1).padStart(2,"0")}</b>{stage.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

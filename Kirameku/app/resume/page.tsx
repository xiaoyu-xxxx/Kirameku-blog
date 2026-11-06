import type { Metadata } from "next";
import { resumeMeta } from "./resumeData";
import ResumeGate from "./ResumeGate";

export const metadata: Metadata = {
  title: resumeMeta.pageTitle,
  description: resumeMeta.description,
};

export default function ResumePage() {
  return <ResumeGate />;
}

import type { Metadata } from "next";
import { resumeMeta } from "./resumeData";
import ResumeView from "./ResumeView";

export const metadata: Metadata = {
  title: resumeMeta.pageTitle,
  description: resumeMeta.description,
};

export default function ResumePage() {
  return <ResumeView />;
}

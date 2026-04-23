import { Home } from "./home";
import { initializeSkillsBundler } from "@/lib/ai/skills/init";

export default async function Page() {
  // Init skills bundler and move project workspace skills to the user session workspace.
  await initializeSkillsBundler();

  return (
    <>
      <Home key="stable-chat-panel" />
    </>
  );
}

import { DynamicTool } from "@langchain/core/tools";
import { loadTechnicalAnalysisSkill } from "./technical-analysis";
import { loadNewsAnalysisSkill } from "./news-analysis";

// ==================== SKILL REGISTRY ====================

export interface Skill {
  name: string;
  description: string;
  content: string;
}

const SKILL_REGISTRY: Record<string, () => string> = {
  technical_analysis: loadTechnicalAnalysisSkill,
  news_analysis: loadNewsAnalysisSkill,
};

// ==================== SKILL LOADER ====================

export function loadSkill(skillName: string): string {
  const loader = SKILL_REGISTRY[skillName];
  if (!loader) {
    return `Không tìm thấy skill: ${skillName}. Có sẵn: ${Object.keys(SKILL_REGISTRY).join(", ")}`;
  }
  return loader();
}

export function listSkills(): string[] {
  return Object.keys(SKILL_REGISTRY);
}

// ==================== SKILL TOOL ====================

export function createSkillLoaderTool(): DynamicTool {
  return new DynamicTool({
    name: "load_skill",
    description: `Load một skill chuyên biệt. Available skills: ${Object.keys(SKILL_REGISTRY).join(", ")}`,
    func: async (input: string) => {
      const skillName = input.trim().toLowerCase();
      return loadSkill(skillName);
    },
  });
}

// ==================== SKILL FACTORY ====================

export function createAllSkillTools(): DynamicTool[] {
  return [createSkillLoaderTool()];
}

export { loadTechnicalAnalysisSkill } from "./technical-analysis";
export { loadNewsAnalysisSkill } from "./news-analysis";

import type { UpworkConfig } from "@/types/config/upwork"
import { describe, expect, it } from "vitest"
import {
  buildUpworkCoverLetterPrompt,
  isUpworkJobDetailUrl,
  translateTextWithProvider,
  UPWORK_QUICK_PROMPT_ANALYZE_JOB,
  UPWORK_QUICK_PROMPT_COVER_LETTER,
} from "../upwork"

describe("Upwork Sidepanel Utilities", () => {
  it("defines standard quick prompt constants", () => {
    expect(UPWORK_QUICK_PROMPT_COVER_LETTER).toBeDefined()
    expect(UPWORK_QUICK_PROMPT_ANALYZE_JOB).toBeDefined()
  })

  describe("isUpworkJobDetailUrl", () => {
    it("returns true for standard job detail URLs", () => {
      expect(
        isUpworkJobDetailUrl(
          "https://www.upwork.com/jobs/WordPress-Front-End-Tweaks-Small-CSS-Job_~022121239593247542729",
        ),
      ).toBe(true)
      expect(isUpworkJobDetailUrl("https://www.upwork.com/jobs/~01abc123")).toBe(true)
      expect(isUpworkJobDetailUrl("https://www.upwork.com/freelance-jobs/apply/~01abc123/")).toBe(
        true,
      )
      expect(isUpworkJobDetailUrl("https://upwork.com/proposals/job/~01abc123/apply/")).toBe(true)
    })

    it("returns false for non-job URLs or non-upwork sites", () => {
      expect(isUpworkJobDetailUrl("https://www.google.com")).toBe(false)
      expect(isUpworkJobDetailUrl("https://www.upwork.com")).toBe(false)
      expect(isUpworkJobDetailUrl("https://www.upwork.com/nx/search/talent/")).toBe(false)
      expect(isUpworkJobDetailUrl("")).toBe(false)
      expect(isUpworkJobDetailUrl(undefined)).toBe(false)
    })
  })

  describe("buildUpworkCoverLetterPrompt", () => {
    const mockConfig: UpworkConfig = {
      enabled: true,
      profile:
        "5 năm kinh nghiệm React, TypeScript, Next.js và Tailwind CSS. Đã làm 20+ dự án SaaS.",
      wordCount: 180,
      tone: "concise",
      rules: "- Không chào sáo rỗng\n- Đi thẳng vào giải pháp",
      examples: "Hi, I have built similar React SaaS applications...",
      translateLang: "en",
      translateProviderId: "",
      jobDetailsSelector: ".job-desc",
      screeningQuestionsSelector: ".question",
      coverLetterInputSelector: "textarea.cover-letter",
    }

    it("constructs system prompt with strict profile facts and rules", () => {
      const { userPrompt, systemPrompt } = buildUpworkCoverLetterPrompt(mockConfig, {
        title: "Frontend Developer needed",
        url: "https://www.upwork.com/jobs/~01test",
        description: "We need someone to build a React dashboard.",
        screeningQuestions: [
          "Do you have experience with Next.js App Router?",
          "What is your timezone?",
        ],
      })

      // Verify system prompt
      expect(systemPrompt).toContain("CHỈ ĐƯỢC PHÉP DÙNG FACTS CÓ TRONG HỒ SƠ (PROFILE FACTS)")
      expect(systemPrompt).toContain("Tuyệt đối KHÔNG BỊA ĐẶT")
      expect(systemPrompt).toContain("5 năm kinh nghiệm React, TypeScript")
      expect(systemPrompt).toContain("concise")
      expect(systemPrompt).toContain("180 từ")
      expect(systemPrompt).toContain("Không chào sáo rỗng")
      expect(systemPrompt).toContain("Hi, I have built similar React SaaS")

      // Verify user prompt
      expect(userPrompt).toContain("Frontend Developer needed")
      expect(userPrompt).toContain("We need someone to build a React dashboard.")
      expect(userPrompt).toContain("Do you have experience with Next.js App Router?")
      expect(userPrompt).toContain("What is your timezone?")
    })

    it("handles fallback when no screening questions exist", () => {
      const { userPrompt } = buildUpworkCoverLetterPrompt(mockConfig, {
        title: "CSS Tweaks",
        description: "Fix button styling.",
      })

      expect(userPrompt).toContain("CSS Tweaks")
      expect(userPrompt).toContain("Fix button styling.")
      expect(userPrompt).not.toContain("CÂU HỎI SÀNG LỌC")
    })

    it("includes language instruction when translateLang is specified", () => {
      const { systemPrompt } = buildUpworkCoverLetterPrompt(
        { ...mockConfig, translateLang: "vi" },
        { title: "Job Title", description: "Job Desc" },
      )
      expect(systemPrompt).toContain("Ngôn ngữ phản hồi: Toàn bộ Cover Letter")
      expect(systemPrompt).toContain("VI")
    })
  })

  describe("translateTextWithProvider", () => {
    it("returns original text when targetLang is original or empty", async () => {
      const res = await translateTextWithProvider("Sample text", "original", "", [])
      expect(res).toBe("Sample text")

      const resEmpty = await translateTextWithProvider("Sample text", "", "", [])
      expect(resEmpty).toBe("Sample text")
    })
  })
})

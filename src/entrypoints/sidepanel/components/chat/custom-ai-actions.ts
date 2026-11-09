import type { LucideIcon } from "lucide-react"
import {
  Brain,
  CheckCheck,
  Code,
  FileText,
  HelpCircle,
  Languages,
  Lightbulb,
  ListCollapse,
  Mail,
  Scale,
  Sparkles,
} from "lucide-react"

export interface CustomAIAction {
  id: string
  title: string
  description: string
  prompt: string
  category: "summarize" | "explain" | "write" | "translate" | "code" | "analyze" | "brainstorm"
  keywords: string[]
  icon: LucideIcon
}

export const CUSTOM_AI_ACTIONS: CustomAIAction[] = [
  {
    id: "summarize",
    title: "Tóm tắt nội dung (Summarize)",
    description: "Tóm tắt ngắn gọn các luận điểm và thông tin chính của nội dung",
    prompt: "Hãy tóm tắt ngắn gọn các luận điểm và thông tin chính của nội dung sau:\n\n",
    category: "summarize",
    keywords: ["summarize", "tom tat", "summary", "brief", "rut gon", "tong hop"],
    icon: FileText,
  },
  {
    id: "explain",
    title: "Giải thích đơn giản (Explain & Simplify)",
    description: "Giải thích khái niệm phức tạp bằng ngôn từ trực quan, dễ hiểu",
    prompt:
      "Hãy giải thích nội dung/khái niệm sau bằng ngôn ngữ đơn giản, dễ hiểu và cho ví dụ minh họa trực quan:\n\n",
    category: "explain",
    keywords: ["explain", "giai thich", "clarify", "don gian", "de hieu", "chi tiet"],
    icon: HelpCircle,
  },
  {
    id: "key-takeaways",
    title: "Điểm mấu chốt (Key Takeaways)",
    description: "Trích xuất 3-5 bài học cốt lõi và điểm quan trọng cần ghi nhớ",
    prompt:
      "Hãy trích xuất 3-5 điểm mấu chốt quan trọng nhất (Key Takeaways) và bài học thực tiễn từ nội dung sau:\n\n",
    category: "summarize",
    keywords: ["takeaways", "cot loi", "mau chot", "key points", "bullet points", "bai hoc"],
    icon: ListCollapse,
  },
  {
    id: "grammar-polish",
    title: "Sửa lỗi & Trau chuốt (Grammar & Polish)",
    description: "Kiểm tra ngữ pháp, lỗi chính tả và nâng cấp văn phong tự nhiên",
    prompt:
      "Hãy kiểm tra lỗi chính tả, ngữ pháp và viết lại đoạn văn sau theo phong cách chuyên nghiệp, trôi chảy hơn:\n\n",
    category: "write",
    keywords: ["grammar", "polish", "ngu phap", "chinh ta", "sua loi", "van phong", "trau chuot"],
    icon: CheckCheck,
  },
  {
    id: "translate-vi",
    title: "Dịch sang Tiếng Việt (Translate to Vietnamese)",
    description: "Dịch tự nhiên, đúng ngữ cảnh sang tiếng Việt chuẩn xác",
    prompt:
      "Hãy dịch nội dung sau sang Tiếng Việt một cách tự nhiên, chuẩn xác và đúng ngữ cảnh:\n\n",
    category: "translate",
    keywords: ["translate", "vietnamese", "tieng viet", "dich", "viet", "dich thuat"],
    icon: Languages,
  },
  {
    id: "translate-en",
    title: "Dịch sang Tiếng Anh (Translate to English)",
    description: "Dịch tự nhiên sang tiếng Anh chuẩn phong cách bản xứ",
    prompt: "Please translate the following content into natural, professional English:\n\n",
    category: "translate",
    keywords: ["translate", "english", "tieng anh", "dich anh", "en", "dich"],
    icon: Languages,
  },
  {
    id: "pros-cons",
    title: "Phân tích Ưu & Nhược điểm (Pros & Cons)",
    description: "Đánh giá đa chiều, so sánh ưu điểm và nhược điểm khách quan",
    prompt:
      "Hãy phân tích chi tiết và khách quan các ưu điểm (Pros) cùng nhược điểm (Cons) của vấn đề sau:\n\n",
    category: "analyze",
    keywords: ["pros", "cons", "uu diem", "nhuoc diem", "so sanh", "danh gia", "hai mat"],
    icon: Scale,
  },
  {
    id: "code-review",
    title: "Review & Tối ưu Code (Code Review)",
    description: "Phát hiện bug tiềm ẩn, tối ưu hiệu năng và viết lại code sạch",
    prompt:
      "Hãy review đoạn code sau, chỉ ra các bug tiềm ẩn hoặc điểm cần tối ưu về hiệu năng/clean code, và viết lại mã cải tiến:\n\n",
    category: "code",
    keywords: ["code", "review", "bug", "lap trinh", "optimize", "refactor", "js", "ts", "python"],
    icon: Code,
  },
  {
    id: "draft-email",
    title: "Soạn Email phản hồi (Draft Reply Email)",
    description: "Viết email chuyên nghiệp, lịch sự, rõ ràng và mạch lạc",
    prompt:
      "Hãy soạn một email phản hồi chuyên nghiệp, lịch sự, mạch lạc và súc tích dựa trên nội dung sau:\n\n",
    category: "write",
    keywords: ["email", "soan thao", "thu tu", "reply", "phan hoi", "gui mail"],
    icon: Mail,
  },
  {
    id: "critical-thinking",
    title: "Tư duy phản biện (Critical Thinking)",
    description: "Tìm ra các lỗ hổng lập luận hoặc các góc nhìn trái chiều",
    prompt:
      "Hãy đóng vai một chuyên gia phản biện khách quan, phân tích các giả định ngầm, tìm lỗ hổng lập luận hoặc nêu góc nhìn trái chiều đối với quan điểm sau:\n\n",
    category: "analyze",
    keywords: ["critical", "phan bien", "logic", "lap luan", "goc nhin", "tranh luan"],
    icon: Brain,
  },
  {
    id: "action-items",
    title: "Lập danh sách việc cần làm (Action Items)",
    description: "Chuyển nội dung thành Checklist công việc cụ thể theo thứ tự ưu tiên",
    prompt:
      "Hãy chuyển đổi nội dung sau thành một danh sách công việc cụ thể (Action Items/Checklist) kèm phân loại ưu tiên rõ ràng:\n\n",
    category: "summarize",
    keywords: ["action", "todo", "checklist", "cong viec", "ke hoach", "nhiem vu"],
    icon: Sparkles,
  },
  {
    id: "brainstorm",
    title: "Brainstorm Ý Tưởng Mới (Brainstorm Ideas)",
    description: "Đề xuất 5-10 ý tưởng sáng tạo và giải pháp đột phá cho chủ đề này",
    prompt:
      "Hãy đóng vai chuyên gia sáng tạo, đề xuất 5-10 ý tưởng độc đáo, khả thi và đột phá cho chủ đề sau:\n\n",
    category: "brainstorm",
    keywords: ["brainstorm", "y tuong", "sang tao", "ideas", "dot pha", "giai phap"],
    icon: Lightbulb,
  },
]

export function normalizeSearchString(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

export function filterCustomAIActions(
  query: string,
  actions: CustomAIAction[] = CUSTOM_AI_ACTIONS,
): CustomAIAction[] {
  // Strip leading slash if present
  const cleaned = query.startsWith("/") ? query.slice(1) : query
  const normalized = normalizeSearchString(cleaned)

  if (!normalized) {
    return actions
  }

  return actions.filter((action) => {
    const titleMatch = normalizeSearchString(action.title).includes(normalized)
    const descMatch = normalizeSearchString(action.description).includes(normalized)
    const categoryMatch = normalizeSearchString(action.category).includes(normalized)
    const keywordMatch = action.keywords.some((k) => normalizeSearchString(k).includes(normalized))

    return titleMatch || descMatch || categoryMatch || keywordMatch
  })
}

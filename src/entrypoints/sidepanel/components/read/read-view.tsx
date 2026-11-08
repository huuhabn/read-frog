import { useEffect, useRef, useState } from "react"
import { useAtom, useAtomValue } from "jotai"
import { BookOpen, Check, Copy, FileText, Globe, RefreshCw, Sparkles, Square } from "lucide-react"
import type { BackgroundTextStreamSnapshot } from "@/types/background-stream"
import { isLLMProviderConfig } from "@/types/config/provider"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { Badge } from "@/components/ui/base-ui/badge"
import { Button } from "@/components/ui/base-ui/button"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { includePageContextAtom, selectedChatModelAtom, sidepanelNavTabAtom } from "@/utils/atoms/sidepanel"
import { streamBackgroundText } from "@/utils/content-script/background-stream-client"
import { getActiveTabContent, type ActiveTabContent } from "@/utils/sidepanel/page-context"

type SummaryMode = "takeaways" | "tldr" | "outline"

export function ReadView() {
  const selectedModel = useAtomValue(selectedChatModelAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const [, setNavTab] = useAtom(sidepanelNavTabAtom)
  const [, setUsePageContext] = useAtom(includePageContextAtom)

  const [activeTab, setActiveTab] = useState<ActiveTabContent | null>(null)
  const [isLoadingTab, setIsLoadingTab] = useState(false)
  const [summary, setSummary] = useState("")
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [activeMode, setActiveMode] = useState<SummaryMode>("takeaways")
  const [isCopied, setIsCopied] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)

  const loadTab = async () => {
    setIsLoadingTab(true)
    try {
      const content = await getActiveTabContent()
      setActiveTab(content)
    } finally {
      setIsLoadingTab(false)
    }
  }

  useEffect(() => {
    let isSubscribed = true
    void getActiveTabContent().then((content) => {
      if (isSubscribed) {
        setActiveTab(content)
      }
    })
    return () => {
      isSubscribed = false
    }
  }, [])

  const handleCopy = async () => {
    if (!summary) return
    await navigator.clipboard.writeText(summary)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleSummarize = async (mode: SummaryMode) => {
    if (!activeTab?.pageText || isSummarizing) return

    setActiveMode(mode)
    setSummary("")
    setIsSummarizing(true)

    const controller = new AbortController()
    abortControllerRef.current = controller

    let systemInstruction: string
    if (mode === "takeaways") {
      systemInstruction =
        "Hãy đọc bài viết sau và tóm tắt thành các ý cốt lõi (Key Takeaways) bằng Tiếng Việt. Sử dụng định dạng gạch đầu dòng rõ ràng, ngắn gọn và làm nổi bật các con số, kết luận quan trọng."
    } else if (mode === "tldr") {
      systemInstruction =
        "Hãy tóm tắt bài viết sau thành một đoạn văn ngắn gọn (TL;DR) từ 2-4 câu bằng Tiếng Việt, truyền tải trọn vẹn thông điệp chính."
    } else {
      systemInstruction =
        "Hãy trích xuất dàn ý (Outline) logic của bài viết bằng Tiếng Việt với các đề mục và phân tích ngắn gọn từng phần."
    }

    const matchedProvider = providersConfig.find((p) => p.id === selectedModel.providerId)

    try {
      await streamBackgroundText(
        {
          providerKind: "local",
          providerId: selectedModel.providerId,
          providerConfig: matchedProvider && isLLMProviderConfig(matchedProvider) ? matchedProvider : undefined,
          messages: [
            {
              role: "system",
              content: systemInstruction,
            },
            {
              role: "user",
              content: `Tiêu đề: ${activeTab.title || ""}\nURL: ${activeTab.url || ""}\nNội dung bài viết:\n${activeTab.pageText}`,
            },
          ],
          temperature: 0.3,
        },
        {
          signal: controller.signal,
          onChunk: (snapshot: BackgroundTextStreamSnapshot) => {
            setSummary(snapshot.output || "")
          },
        },
      )
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setSummary((prev) => `${prev}\n\n*(Lỗi tóm tắt: ${(err as Error)?.message || "Không thể kết nối model"})*`)
      }
    } finally {
      setIsSummarizing(false)
      abortControllerRef.current = null
    }
  }

  const handleStop = () => {
    abortControllerRef.current?.abort()
    setIsSummarizing(false)
  }

  const handleAskInChat = () => {
    setUsePageContext(true)
    setNavTab("chat")
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex h-12 items-center justify-between border-b border-border/60 px-4">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight">Read & Summarize</h2>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="size-7.5"
          onClick={() => void loadTab()}
          disabled={isLoadingTab}
          title="Tải lại nội dung tab"
        >
          <RefreshCw className={isLoadingTab ? "size-3.5 animate-spin" : "size-3.5"} />
        </Button>
      </header>

      {/* Page Info Card */}
      <div className="border-b border-border/50 bg-muted/20 p-3">
        <div className="flex items-start gap-2">
          <Globe className="size-4 shrink-0 text-muted-foreground mt-0.5" />
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="truncate text-xs font-medium text-foreground">
              {activeTab?.title || "Không nhận diện được tab"}
            </h3>
            <p className="truncate text-[10px] text-muted-foreground">{activeTab?.url}</p>
            {activeTab?.pageText && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                ~{activeTab.pageText.length} ký tự
              </Badge>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <Button
            size="sm"
            variant={activeMode === "takeaways" ? "default" : "outline"}
            className="h-7 text-xs font-normal"
            disabled={!activeTab?.pageText || isSummarizing}
            onClick={() => void handleSummarize("takeaways")}
          >
            Key Points
          </Button>
          <Button
            size="sm"
            variant={activeMode === "tldr" ? "default" : "outline"}
            className="h-7 text-xs font-normal"
            disabled={!activeTab?.pageText || isSummarizing}
            onClick={() => void handleSummarize("tldr")}
          >
            TL;DR
          </Button>
          <Button
            size="sm"
            variant={activeMode === "outline" ? "default" : "outline"}
            className="h-7 text-xs font-normal"
            disabled={!activeTab?.pageText || isSummarizing}
            onClick={() => void handleSummarize("outline")}
          >
            Outline
          </Button>
        </div>
      </div>

      {/* Summary Content Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {summary ? (
          <div className="relative group/sum rounded-xl border border-border/60 bg-muted/20 p-3 text-xs leading-relaxed">
            <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-3">
              <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                {activeMode === "takeaways"
                  ? "Key Takeaways"
                  : activeMode === "tldr"
                    ? "Tóm tắt ngắn (TL;DR)"
                    : "Dàn ý bài viết"}
              </span>
              <div className="flex items-center gap-1">
                {isSummarizing && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-6 px-2 text-[10px] gap-1"
                    onClick={handleStop}
                  >
                    <Square className="size-2.5" />
                    Dừng
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-6 text-muted-foreground hover:text-foreground"
                  onClick={() => void handleCopy()}
                >
                  {isCopied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                </Button>
              </div>
            </div>
            <MarkdownRenderer content={summary} />
          </div>
        ) : (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <FileText className="size-8 opacity-30" />
            <p>Chọn một kiểu tóm tắt ở trên để AI phân tích trang web này.</p>
          </div>
        )}
      </div>

      {/* Bottom Footer Actions */}
      <div className="border-t border-border/60 p-3 bg-muted/10">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 text-xs"
          onClick={handleAskInChat}
        >
          <Sparkles className="size-3.5 text-primary" />
          Hỏi sâu hơn về trang này trong Chat
        </Button>
      </div>
    </div>
  )
}

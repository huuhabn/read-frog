import type { BackgroundTextStreamSnapshot } from "@/types/background-stream"
import { useAtomValue } from "jotai"
import { ArrowDown, Check, Copy, FileEdit, PenTool, Sparkles, Square } from "lucide-react"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Textarea } from "@/components/ui/base-ui/textarea"
import { isLLMProviderConfig } from "@/types/config/provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { selectedChatModelAtom } from "@/utils/atoms/sidepanel"
import { streamBackgroundText } from "@/utils/content-script/background-stream-client"
import { getActiveTabContent } from "@/utils/sidepanel/page-context"

type WriteAction = "polish" | "formal" | "casual" | "shorten" | "grammar"

const ACTION_BUTTONS: Array<{ id: WriteAction; label: string; desc: string }> = [
  { id: "polish", label: "Trau chuốt", desc: "Viết mượt mà, tự nhiên hơn" },
  { id: "formal", label: "Trang trọng", desc: "Giọng văn chuyên nghiệp, lịch sự" },
  { id: "casual", label: "Thân mật", desc: "Giọng văn gần gũi, thoải mái" },
  { id: "shorten", label: "Rút gọn", desc: "Súc tích, bỏ chi tiết thừa" },
  { id: "grammar", label: "Sửa ngữ pháp", desc: "Sửa lỗi chính tả & cấu trúc câu" },
]

function getInstructionForAction(action: WriteAction): string {
  switch (action) {
    case "polish":
      return "Hãy viết lại văn bản sau sao cho mượt mà, giàu sức biểu đạt và tự nhiên hơn nhưng vẫn giữ nguyên ý nghĩa cốt lõi. Giữ nguyên ngôn ngữ gốc của văn bản."
    case "formal":
      return "Hãy chuyển đổi văn bản sau sang giọng văn trang trọng, chuẩn mực công sở/kinh doanh (formal business tone). Giữ nguyên ngôn ngữ gốc."
    case "casual":
      return "Hãy chuyển đổi văn bản sau sang giọng văn thân mật, dễ hiểu, tự nhiên (casual conversational tone). Giữ nguyên ngôn ngữ gốc."
    case "shorten":
      return "Hãy rút gọn văn bản sau sao cho ngắn gọn, cô đọng nhất mà vẫn truyền tải trọn vẹn thông điệp chính. Giữ nguyên ngôn ngữ gốc."
    case "grammar":
      return "Hãy phát hiện và sửa toàn bộ lỗi chính tả, ngữ pháp, dấu câu và dùng từ trong đoạn văn sau. Trình bày lại đoạn văn đã sửa sạch đẹp."
    default:
      return "Hãy viết lại văn bản sau một cách rõ ràng và mạch lạc hơn."
  }
}

export function WriteView() {
  const selectedModel = useAtomValue(selectedChatModelAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  const [inputText, setInputText] = useState("")
  const [outputText, setOutputText] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentAction, setCurrentAction] = useState<WriteAction>("polish")
  const [isCopied, setIsCopied] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)

  const handlePasteSelection = async () => {
    const tabInfo = await getActiveTabContent()
    if (tabInfo?.selectedText) {
      setInputText(tabInfo.selectedText)
    }
  }

  const handleCopy = async () => {
    if (!outputText) return
    await navigator.clipboard.writeText(outputText)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleExecute = async (action: WriteAction) => {
    if (!inputText.trim() || isProcessing) return

    setCurrentAction(action)
    setOutputText("")
    setIsProcessing(true)

    const controller = new AbortController()
    abortControllerRef.current = controller

    const instruction = getInstructionForAction(action)
    const matchedProvider = providersConfig.find((p) => p.id === selectedModel.providerId)

    try {
      await streamBackgroundText(
        {
          providerKind: "local",
          providerId: selectedModel.providerId,
          providerConfig:
            matchedProvider && isLLMProviderConfig(matchedProvider) ? matchedProvider : undefined,
          messages: [
            { role: "system", content: instruction },
            { role: "user", content: inputText },
          ],
          temperature: 0.5,
        },
        {
          signal: controller.signal,
          onChunk: (snapshot: BackgroundTextStreamSnapshot) => {
            setOutputText(snapshot.output || "")
          },
        },
      )
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setOutputText(`*(Lỗi: ${(err as Error)?.message || "Không thể xử lý văn bản"})*`)
      }
    } finally {
      setIsProcessing(false)
      abortControllerRef.current = null
    }
  }

  const handleStop = () => {
    abortControllerRef.current?.abort()
    setIsProcessing(false)
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex h-12 items-center justify-between border-b border-border/60 px-4">
        <div className="flex items-center gap-2">
          <PenTool className="size-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight">Write & Compose</h2>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-[11px]"
          onClick={() => void handlePasteSelection()}
        >
          <FileEdit className="size-3" />
          Dán chữ bôi đen
        </Button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Input Text Box */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Văn bản gốc:</label>
            <span className="text-[10px] text-muted-foreground">{inputText.length} ký tự</span>
          </div>
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Nhập hoặc dán đoạn văn bản cần viết lại..."
            rows={4}
            className="resize-none text-xs"
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Chọn phong cách:</label>
          <div className="grid grid-cols-2 gap-1.5">
            {ACTION_BUTTONS.map((btn) => (
              <Button
                key={btn.id}
                size="sm"
                variant={currentAction === btn.id ? "default" : "outline"}
                className="h-8 justify-start px-2.5 text-xs font-normal"
                disabled={!inputText.trim() || isProcessing}
                onClick={() => void handleExecute(btn.id)}
              >
                <Sparkles className="mr-1 size-3 shrink-0 text-primary" />
                <span className="truncate">{btn.label}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Output Text Box */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Kết quả chỉnh sửa:</label>
            <div className="flex items-center gap-1">
              {isProcessing && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-6 gap-1 px-2 text-[10px]"
                  onClick={handleStop}
                >
                  <Square className="size-2.5" />
                  Dừng
                </Button>
              )}
              {outputText && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1 px-2 text-[10px] text-muted-foreground"
                    onClick={() => {
                      setInputText(outputText)
                      setOutputText("")
                    }}
                    title="Đặt kết quả làm văn bản gốc để chỉnh tiếp"
                  >
                    <ArrowDown className="size-3" />
                    Chỉnh tiếp
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 text-muted-foreground hover:text-foreground"
                    onClick={() => void handleCopy()}
                  >
                    {isCopied ? (
                      <Check className="size-3 text-emerald-500" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="min-h-[120px] rounded-lg border border-border/70 bg-muted/20 p-3 text-xs leading-relaxed">
            {outputText ? (
              <p className="whitespace-pre-wrap">{outputText}</p>
            ) : (
              <div className="flex h-24 items-center justify-center text-xs text-muted-foreground/60 italic">
                {isProcessing ? "AI đang viết lại..." : "Kết quả sẽ xuất hiện ở đây"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

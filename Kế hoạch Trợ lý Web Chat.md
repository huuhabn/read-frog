# Kế hoạch Trợ lý AI

## 1. Bộ tính năng

| Nhóm        | Tính năng                                                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ngữ cảnh    | Tóm tắt tin chưa đọc (50–100 tin, gom chủ đề, action items) · Hỏi đáp theo hội thoại · Trích xuất SĐT, địa chỉ, STK, link, lịch hẹn                     |
| Soạn thảo   | Gợi ý trả lời 3 giọng (chuyên nghiệp, thân mật, ngắn gọn) · Viết lại đoạn bôi đen · Dịch inline 2 chiều                                                 |
| Tự động hóa | Slash `/reply` `/tone` `/dich` `/tpl` (có biến `{{ten_nguoi_nhan}}`) · Message-to-Action qua Webhook (Notion, Calendar, Todoist, CRM) · Follow-up Radar |
| Bảo mật     | PII Masking (`[PHONE_1]`…, giải mã khi hiển thị) · BYOK (Gemini, OpenAI, Claude) và Local LLM (Ollama)                                                  |

## 2. UI/UX: 3 điểm chạm

Ba bề mặt xử lý tại chỗ, không làm gián đoạn mạch nhắn tin.

**Side Panel (không gian làm việc chính)**

- Header: tên phòng, số tin đã nạp, nút làm mới, trạng thái Cloud / Local / PII.
- Chip hành động nhanh, vùng stream kết quả với nút Chèn và Sao chép.
- Cache theo `chatId`; khi đổi phòng **không tự gọi LLM**, tránh tốn token khi chỉ lướt xem.

**Floating Menu (Shadow DOM)**

- Hiện cách vùng bôi đen 8px phía trên, tự lật xuống nếu sát mép trình duyệt.
- Compact Bar 4 nút (Dịch, Viết lại, Trả lời, Hỏi AI) mở ra Inline Popover với nút Thay thế hoặc Gửi vào ô chat.
- Đóng bằng Esc, cuộn trang hoặc click ra ngoài.

**Slash Command**

- Chỉ mở khi `/` đứng đầu dòng hoặc sau dấu cách (tránh bật nhầm khi dán URL).
- Khi palette mở, chặn `ArrowUp`, `ArrowDown`, `Tab`, `Enter` ở pha capture bằng `preventDefault` và `stopPropagation`.
- `/reply` chỉ gọi LLM **1 lần**, kèm 5 tin gần nhất, trả JSON `{reply_text, vi_gloss}`. Dual Preview hiện bản trả lời ở trên, bản dịch ngược tiếng Việt ở dưới.
- Tab hoặc Enter chỉ chèn vào ô chat, **không tự gửi**. Ép ngôn ngữ đích bằng `/reply:zh ...`.

## 3. Dịch song ngữ thời gian thực

**Hai chiều**

- **Đến:** chèn sub-line (Shadow DOM) dưới nội dung gốc, trước timestamp để không vỡ layout. Bật/tắt theo từng phòng; bỏ qua tin cùng ngôn ngữ mẹ đẻ, emoji, SĐT, URL.
- **Đi:** phím `Ctrl+Shift+E`, lệnh `/``t``ran`, hoặc tự dịch khi dừng gõ 400ms, hiện preview nổi phía trên ô nhập.

**Tối ưu hiệu năng và chi phí**

- Gửi kèm 3–5 tin trước làm ngữ cảnh chỉ đọc để giữ đúng đại từ nhân xưng và thuật ngữ.
- Gom 10–15 tin đang nằm trong viewport thành 1 request bằng `IntersectionObserver`.
- Tiered engine: model nhẹ hoặc Chrome Translator API cho câu ngắn, model mạnh cho văn bản dài.
- Cache IndexedDB theo `hash(nội dung + ngôn ngữ đích)`; `MutationObserver` gắn lại bản dịch ngay khi virtual scrolling tạo lại DOM.
- Tách `@mention`, URL, code block thành placeholder (`__MENTION_0__`, `__URL_1__`) trước khi dịch, khôi phục sau.

## 4. Kiến trúc đa nền tảng

Interface `IChatAdapter` tách lõi AI/UI khỏi DOM từng web; mỗi nền tảng (Zalo, Telegram, Slack, Generic) chỉ cần một adapter.

**Generic Adapter (mọi trang có khung chat)**

- Lắng nghe `focusin` trên `textarea`, `[contenteditable]`, `[role=textbox]` để bật Slash Command và Floating Preview.
- Chèn chữ: thử `execCommand('insertText')` trước; nếu framework không nhận, fallback sang `ClipboardEvent('paste')` kèm `DataTransfer`.
- Đọc ngữ cảnh bằng heuristic tìm vùng cuộn phía trên ô nhập, hoặc dùng Floating Menu (bôi đen) vốn độc lập với cấu trúc trang.

**Cập nhật selector không cần chờ Store duyệt**

- Remote Config JSON trên CDN/GitHub Pages, cache vào `chrome.storage.local`, làm mới ngầm mỗi 6–12 giờ.
- Visual Element Picker: người dùng click chọn vùng tin nhắn trên trang, extension tự sinh selector ổn định.

**Quyền trong manifest**

- `host_permissions` tường minh cho Zalo, Telegram, Slack.
- Trang khác dùng `activeTab` + `scripting`, tránh `<all_urls>` để dễ qua duyệt Chrome Web Store.

## 5. Trang Settings

Quick Settings nằm trong Side Panel; Full Settings là `options.html` dạng sidebar 5 tab.

| Tab                 | Tùy chọn chính                                                                                               | Lưu ở          |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | -------------- |
| 1. Dịch             | Ngôn ngữ mẹ đẻ và đích; kiểu hiển thị; số tin ngữ cảnh (mặc định 5); phòng bật tự dịch                       | `storage.sync` |
| 2. Lệnh & Văn phòng | Bật/tắt `/`; phím tắt; CRUD mẫu `/tpl`; prompt và cặp xưng hô theo tone                                      | `storage.sync` |
| 4. Nền tảng         | Bật/tắt Zalo, Telegram, Slack, Discord; chế độ Universal; blacklist domain; Remote Config; selector nâng cao | `storage.sync` |
| 5. Riêng tư         | Bật/tắt che PII; dung lượng và xóa cache IndexedDB; Export/Import JSON                                       | `d``b`         |

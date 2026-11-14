# Plan triển khai Theme cho Workmate AI

Người dùng mới thấy ngay theme `default` theo chế độ hệ thống ở Side Panel, Options và Floating Menu, không nháy màu; ai đã chọn riêng thì giữ nguyên lựa chọn.

## Quyết định đã chốt

| Hạng mục        | Quyết định                                                          |
| --------------- | ------------------------------------------------------------------- |
| Theme mặc định  | `default`                                                           |
| Sáng/tối        | Theo hệ thống (`prefers-color-scheme`), cho phép chọn Sáng hoặc Tối |
| Biến thể Scaled | Làm ngay từ đầu                                                     |
| Hướng chữ       | Hỗ trợ cả LTR và RTL                                                |

## Bước 1: Nguồn sự thật (`src/lib/theme.ts`)

Lưu 3 giá trị bằng `storage` của WXT. Giá trị mặc định chỉ là `fallback`, **không ghi vào storage** lúc cài đặt, để ai chưa chọn sẽ tự theo `DEFAULT_THEME` nếu sau này đổi.

| Key           | Giá trị                   | Mặc định  |
| ------------- | ------------------------- | --------- |
| `sync:theme`  | `default`, `polithien`, … | `default` |
| `sync:mode`   | `system`, `light`, `dark` | `system`  |
| `sync:scaled` | `true`, `false`           | `false`   |

Hướng chữ (`dir`) không lưu mà suy ra từ ngôn ngữ giao diện (`ar`, `he`, `fa`, `ur` là RTL, còn lại LTR); thêm tùy chọn ghi đè nếu sau này cần.

`applyTheme(el, { theme, mode, scaled, dir })` đặt lên **một phần tử gốc**:

- `data-theme`
- class `dark`: với mode `system`, đọc `matchMedia("(prefers-color-scheme: dark)")` và lắng nghe sự kiện `change`
- class `theme-scaled`
- `dir` (`ltr` hoặc `rtl`)

## Bước 2: CSS

- `src/styles/themes/default.css` (và các theme khác) chỉ chứa token OKLCH cho light và `.dark`, rồi `@import` vào CSS gốc.
- Nếu CSS gốc kiểu shadcn đã map `--color-*` sang `var(--...)`, mỗi theme chỉ cần ghi đè biến, không lặp khối `@theme`.
- Kiểm tra token trong `:root` không mâu thuẫn với `[data-theme="default"]`.
- Dark variant của Tailwind phải khớp class: `@custom-variant dark (&:is(.dark *))`.
- `.theme-scaled`: khai báo **một lần** ở CSS gốc, ghi đè `--spacing` và các biến cỡ chữ `--text-*`, không cần CSS riêng cho từng theme.

## Bước 3: RTL/LTR trong code UI

- Thay utility vật lý bằng logical: `ml/mr` → `ms/me`, `pl/pr` → `ps/pe`, `left/right` → `start/end`, `text-left` → `text-start`.
- Icon có hướng (mũi tên, chevron, quay lại): thêm `rtl:-scale-x-100`.
- Dòng dịch (sub-line) theo ngôn ngữ **đích** của bản dịch, không theo ngôn ngữ UI: đặt `dir="auto"` trên phần tử đó.
- Floating Menu: vị trí theo vùng bôi đen vẫn dùng tọa độ màn hình; chỉ căn theo phía thì dùng thuộc tính logical (`inset-inline-*`).

## Bước 4: Áp dụng theo bề mặt

Cả ba bề mặt dùng chung hook `useApplyTheme`, theo dõi `watch` của storage và `matchMedia` để đổi theme thời gian thực.

| Bề mặt                         | Cách áp dụng                                                                                                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Side Panel, Options            | Đặt sẵn `data-theme="default"` và `dir` trong HTML. Chống nháy: nhân bản giá trị sang `localStorage` (chỉ ở trang extension) và đọc đồng bộ bằng script nhỏ ở `<head>`, vì Chrome Storage là bất đồng bộ                        |
| Floating Menu (content script) | Đặt `data-theme`, class `dark`, `theme-scaled` và `dir` lên **wrapper bên trong shadow root**, không đụng `<html>` của Zalo/Telegram. Dropdown, popover render ra ngoài wrapper nên cần chỉ định portal container là wrapper đó |

## Bước 5–6: UI cài đặt và kiểm thử

**UI cài đặt:** trong Options, thêm bộ chọn theme (đọc từ `THEMES`), chọn mode (Hệ thống, Sáng, Tối) và công tắc Scaled; giữ bản rút gọn trong Quick Settings.

**Unit test**

- Không có giá trị lưu thì trả về mặc định.
- `applyTheme` đặt đúng 4 thuộc tính.
- Mode `system` bám theo `matchMedia`.
- Hàm suy ra `dir` từ locale.

**Kiểm tra thủ công**

- Cài mới (xóa storage), đổi theme/mode/scaled rồi tải lại.
- Đổi chế độ tối của macOS khi extension đang mở.
- Chuyển sang locale RTL (ví dụ `ar`), kiểm tra Side Panel, Options và Floating Menu trên Zalo và Telegram.
- Dịch một tin sang tiếng Ả Rập và xem dòng dịch hiện đúng chiều.

## Tiêu chí hoàn thành

- Cài mới hiện `default` + theo hệ thống ở cả 3 bề mặt, không nháy.
- Đổi một trong 3 cài đặt thì cả ba bề mặt cập nhật ngay.
- Scaled bật/tắt được trên mọi theme mà không cần CSS riêng.
- Giao diện đảo đúng chiều ở RTL, không còn `ml/mr/left/right` cứng.
- Theme của extension độc lập với theme của trang chat.

## Chưa kiểm chứng

- Hành vi scale khi có `postcss-rem-to-responsive-pixel` trong repo (nên scale bằng biến CSS và kiểm tra kết quả build).
- API portal container của các component đang dùng trong shadow root.
- Mức hỗ trợ locale RTL của `@wxt-dev/i18n` trong cấu hình hiện tại.
- Tên API `storage.defineItem` và `watch` của WXT 0.21.5 cần đối chiếu tài liệu.

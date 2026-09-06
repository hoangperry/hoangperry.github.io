# Review toàn bộ UI — hoang.tech

Ngày: 2026-09-04 · Phạm vi: 13 loại trang, 6 theme, toàn bộ `css/main.scss` (2890 dòng) + `_sass/*` + `_layouts/*` + `_includes/*` + `_pages/*` + `js/*`

Phương pháp: bốn nguồn độc lập, không nguồn nào thấy kết quả của nguồn khác trước khi chấm.

1. Design critique (Nielsen heuristics, cognitive load, AI-slop test theo brand register)
2. Accessibility audit (WCAG 2.2 AA, contrast tính OKLCH → sRGB → luminance cho cả 6 palette)
3. Performance / Responsive / Theming audit (đo bằng headless Chrome qua CDP)
4. Deterministic detector `impeccable detect` (369 findings) + kiểm chứng thủ công trên **production**

Build audit: Jekyll 4.3.4 build tươi từ working tree. Các lỗi P0 đều đã curl xác minh lại trên `https://hoang.tech` — không phải artifact của build local.

---

## Điểm số

| Trục | Điểm | Băng |
|---|---|---|
| Nielsen heuristics | **20 / 40** | Đáy băng bình thường (đa số site thật: 20–32) |
| Accessibility | 2 / 4 | Có nỗ lực thật, lỗ hổng mang tính hệ thống |
| Performance | 2 / 4 | Motion tốt, asset delivery không được quản lý |
| Responsive | 1 / 4 | Bị chặn bởi P0-1 |
| Theming | 2 / 4 | Token sạch, biên component/palette hỏng |
| Anti-patterns (AI slop) | 3 / 4 | Không có tell kinh điển nào |
| **Audit health** | **10 / 20** | Acceptable — cần làm việc đáng kể |

Chênh lệch đáng chú ý: **thẩm mỹ chấm 3, phần đường ống chấm 1.** Đây không phải site xấu. Đây là site mà bề mặt nhìn thấy được thì hoàn thiện, còn bề mặt chức năng thì không.

---

## Verdict AI-slop: PASS, có điều kiện

Không có tell kinh điển nào. Kiểm chứng từng cái:

| Tín hiệu | Có? | Bằng chứng |
|---|---|---|
| Gradient text | Không | 0 lần xuất hiện `background-clip: text` |
| Side-stripe border trên card/callout | Không | Chỉ `blockquote`. Callout dùng border 1px + tint 6%, ngay dưới comment `/* NOTE: ABSOLUTELY NO colored left/right side-stripe on callouts. */` |
| Glassmorphism trang trí | Không | Một `backdrop-filter: blur(8px)` trên sticky header, có chức năng |
| Hero-metric template | Không (còn hoá thạch) | `.hero-metrics` là template chuẩn nhưng **0 trang dùng** — CSS chết |
| Card grid đồng dạng | Không trên homepage | `.world-grid` là editorial row full-bleed với ghost numeral |
| Modal-as-first-thought | Không | Chỉ có slide-in nav, dựng đúng chuẩn dialog |
| Font phản xạ | Không | JetBrains Mono / Martian Mono / Chakra Petch / Sometype Mono / Spectral. Không Inter |
| Palette rụt rè | Không | 6 palette OKLCH commit thật |

Thứ **cứu** verdict này: `js/aviation-hero.js` (324 dòng) và `js/electronics-hero.js` (386 dòng) là canvas instrument viết tay có logic domain thật — ADI với pitch ladder scale `R/28` px mỗi độ, roll arc, tape airspeed/altitude, đọc màu từ live theme token, cap DPR ở 2, pause bằng IntersectionObserver, render static frame khi `prefers-reduced-motion`. Không template nào và không phản xạ nào tạo ra được thứ này.

### Nhưng: category-reflex bậc một — TRƯỢT

"Site cá nhân của kỹ sư phần mềm" → nền near-black, phosphor xanh, mono toàn bộ, CRT scanline, tube vignette, grain tĩnh, animation power-on, caret nhấp nháy, prompt `$ `, prefix `~/`, prefix `> ` cho heading, pill `[label]`.

Đó không phải diễn giải — đó là nội dung nguyên văn của `:root` và block `[data-theme='security']`. Đây chính xác là câu trả lời một model đưa ra cho brief này mà không cần hỏi lại, **và nó là world mặc định mà khách lạ đáp xuống**.

Bậc hai được cứu một phần: EFIS và PCB là thứ model sẽ không tạo ra. Nhưng body copy vẫn là monospace ở **cả năm world**, nên mỗi world đọc ra là "cái terminal đổi màu" chứ không phải một dụng cụ khác. Aviation và electronics dùng chung một skeleton trang. Và phần khác biệt hoá nằm sau một cú click mà persona chính có thể không bao giờ thực hiện.

**Kết luận thẳng:** per-world theming cứu site *cho người chịu khám phá*. Nó không cứu trải nghiệm mặc định. Em đã lấy câu trả lời phản xạ làm mặc định, và lấy tác phẩm gốc làm thứ phải click vào.

### Bốn anti-reference

1. **Dev-portfolio template** — TRÁNH ĐƯỢC, dứt khoát.
2. **Cyberpunk Matrix** — TRÁNH ĐƯỢC SÁT NÚT, một chỗ vi phạm. Glow được áp bằng một block selector liệt kê duy nhất (`main.scss:1526-1533`), không bao giờ chạm `p`/`.prose`/`.log-body`/`.cv-*`. Scanline 5% alpha, grain 4.5%, cả hai tĩnh. Nhưng `@keyframes crt-power-on` đẩy cả `#page-wrapper` qua `brightness(2.4) contrast(1.3)` **mỗi lần load trang** — đúng thứ mà comment cách đó hai block tự cấm ("a flicker is seen on every view, so it must not exist").
3. **Medium/Substack editorial** — TRÁNH ĐƯỢC.
4. **SaaS dashboard** — TRÁNH ĐƯỢC, `.instrument-strip` là near-miss nhưng ở đúng bên vạch.

---

## P0 — Chặn người dùng

### P0-1. Header cố định và menu drawer KHÔNG hề fixed theo viewport

`css/main.scss:1514-1523`

```css
@keyframes crt-power-on {
  100% { transform: scaleY(1) scaleX(1); filter: brightness(1); }
}
#page-wrapper { animation: crt-power-on 620ms var(--ease) both; }
```

`fill-mode: both` giữ giá trị keyframe 100% **vĩnh viễn**. `scale(1)` và `brightness(1)` nhìn thì là no-op, nhưng cả hai đều **khác `none`** — theo CSS Transforms L2 §3 và Filter Effects §6, `#page-wrapper` trở thành containing block cho mọi descendant `position: fixed`.

`#header` và `#menu` đều nằm trong `#page-wrapper` ở cả 4 layout. Kết quả đo được trên mọi trang: ở `scrollY = 1145–1152`, `#header.getBoundingClientRect().top = -1145…-1152`. Header không dính. Nó cuộn đi và không quay lại.

Sau khi cuộn qua màn hình đầu tiên: **không còn brand link, không world nav, không theme switcher, không menu toggle nào trên màn hình.** Trên viewport 375px sau khi cuộn 1398px, toggle nằm ở `top: -1396`. Ép mở menu từ trạng thái đó làm trang nhảy về `scrollY 0`. Drawer cũng lệch: ở 375px nó render tại x ∈ [−135, 160] thay vì sát phải — 46% nằm ngoài màn hình.

**Chứng minh nhân quả bằng control:** bật `prefers-reduced-motion: reduce` kích hoạt `main.scss:1591` và `:1597` (`#page-wrapper { transform: none; filter: none; }`); ở trạng thái đó `#header.top = 0` tại `scrollY 800` và drawer nằm đúng x ∈ [65, 360].

**Site chỉ chạy đúng cho người bật reduced-motion. Tất cả những người còn lại nhận bản hỏng.**

Đã xác minh trên production: `https://hoang.tech/css/main.css` ship đúng `animation: crt-power-on 620ms var(--ease) both;` và `https://hoang.tech/topics/` có `id="page-wrapper"` bọc header.

Fix: kết thúc keyframe ở `transform: none; filter: none` thay vì giá trị identity, hoặc chạy animation trên một element con không chứa descendant fixed. Thêm regression check assert `#header.getBoundingClientRect().top === 0` ở `scrollY` khác 0, **với motion bật**.

### P0-2. Form contact chết, và CTA duy nhất của homepage trỏ vào đó

Xác minh trực tiếp trên production `https://hoang.tech/contact/`:

```html
<form id="sendemail" method="post" action="">
<img src=""/>
```

Bốn lỗi chồng lên nhau:

1. `action=""` — form POST về chính trang đó trên static host. Không gửi đi đâu cả.
2. `<img src=""/>` cạnh input "Type the numbers you see" — captcha là ô ảnh vỡ, không `alt`, không audio/logic alternative. **Người khiếm thị không thể hoàn thành form.** (WCAG 1.1.1, Level A)
3. `jquery.validate.min.js` (22KB) load mà **jQuery core không hề được load** — xác minh: `grep -c jquery.min.js` trên trang production = 0. `$("#sendemail").validate();` ném `ReferenceError`. Toàn bộ cơ chế `aria-invalid`/`aria-describedby` chết.
4. **Không có một `<label>` nào.** Năm field chỉ có placeholder, mà màu placeholder là `--fg-faint` — trượt AA ở mọi theme. (WCAG 3.3.2, Level A)

Cộng thêm: class grid `row uniform` / `6u` / `12u$` là di sản HTML5UP Spectral và **không tồn tại trong bất kỳ stylesheet nào** (grep = 0 match), nên layout hai cột dự định biến thành stack thẳng.

Nguyên nhân gốc: `action` và captcha `src` đọc từ `site.data.tokens.*`, mà `_data/tokens.yml` bị gitignore. **CI workflow không tạo file này** (`.github/workflows/jekyll.yml` chỉ checkout rồi build) — nên nó rỗng trên production, không chỉ trên máy local.

Tại sao nghiêm trọng: đây là bước cuối của hai trên ba user journey. `#cta` homepage viết "Let's talk. Security findings, build ideas, or just aircraft. My inbox is open." và nút duy nhất của nó trỏ vào đây. Ấn tượng cuối cùng của một hiring manager là một cái form nói dối về việc nó dùng được.

Fix: fail closed. Bọc form trong `{% if site.data.tokens.mailaction %}`, else render block `mailto:` + link GitHub/LinkedIn. Bỏ field captcha khi token rỗng. Thay grid class chết bằng `.contact-grid` thật. Thêm `<label for>` cho cả 5 field + `autocomplete="name"` / `"email"`.

### P0-3. Mỗi bài viết render 6–15 thẻ `<h1>` cùng cỡ tiêu đề

**38 / 41** file trong `_posts/` mở section bằng `#`. Đếm được: 1–15 h1 body mỗi bài (`tu-dung-may-chu-tren-raspberry-pi`: 15; `nftables-trong-thuc-chien`: 15; `milvus-nam-2025`: 14). Cộng với `#header h1` (site title) và `header-inner.html` h1 (page title), bài mẫu có **9 thẻ `<h1>`**.

`main.scss:329` cho `h1 { font-size: var(--fs-h1) }` = `clamp(2rem, 1.4rem + 3vw, 3.6rem)`. Nghĩa là bảy heading section render cùng 3.6rem với tiêu đề bài. Không có nhịp h2/h3. Không TOC. Không anchor link nhìn thấy được.

Đây là user goal số 1 của site, trên loại trang được link nhiều nhất. Người đọc lướt một bài 3000 chữ về SPF/DKIM/DMARC để tìm phần DMARC sẽ thấy bảy heading 3.6rem giống hệt nhau, không mang thông tin thứ bậc nào. Với screen reader, document outline là chín heading top-level — điều hướng theo heading trở nên vô dụng. (WCAG 1.3.1, Level A)

Fix: (a) `sed` `^# ` → `^## ` trên 38 file, hạ cấp các level lồng theo. (b) Chống tái phát: scope heading trong article — `.wrapper.style5 .inner h1 { font-size: var(--fs-h2); }`. (c) Hạ `#header h1` thành `<p>` (nó là branding, và `main.scss:602` render nó ở 0.95rem — đã styled như chrome rồi).

---

## P1 — Nghiêm trọng

### P1-4. `--fg-faint` trượt AA ở **cả sáu** palette, dùng ở 38 khai báo

| Theme | trên `--bg` | `--surface` | `--surface-2` | `--surface-3` |
|---|---|---|---|---|
| security | 3.90 | 3.69 | 3.43 | 3.07 |
| aviation | 4.44 | 4.16 | 3.81 | 3.39 |
| aviation-chart | 3.31 | 3.57 | 3.03 | 2.68 |
| electronics | **4.93** ✓ | 4.46 | 3.95 | 3.43 |
| photography | 4.09 | 4.47 | 3.74 | 3.35 |
| reading | 4.21 | 4.47 | 3.91 | 3.57 |

Một ô duy nhất đạt. Token này không phải trang trí — nó chở `.world-nav a` (nav 5 world chính, có mặt trên header mọi trang), `.breadcrumb a`, `#theme-cycle`, `#footer .copyright`, `.log-meta`, `.cn-toc`, `.novel-back`, `::placeholder`, comment trong code block. Tất cả render ở 10.9–12.8px nên ngưỡng 4.5:1 áp dụng, không có miễn trừ large-text.

Ràng buộc thật là `--surface-3`, không phải `--bg`. Nâng khoảng 8–10 điểm L mỗi palette rồi tính lại — đừng ước lượng bằng mắt trên OKLCH.

### P1-5. Số thứ tự world-nav render ở 1.48:1 – 2.24:1

`_sass/_homepage-refresh.scss:28` — `.world-nav a span { color: var(--line); }`

Đó là các số `01`…`05` trong mỗi link nav, và chúng **không** `aria-hidden`, nên nằm trong accessible name của link.

security 1.68 · aviation 2.15 · aviation-chart 2.24 · electronics 2.16 · photography 1.64 · reading 1.48

Xương sống thị giác của hệ thống đánh số thương hiệu đang vô hình. Kèm theo, `_homepage-refresh.scss:23` hard-code `font-size: 0.68rem` (10.88px) — vừa bypass token `--fs-xs`, vừa dưới sàn 11px. Detector bắt được 137 lần chỉ từ một dòng này.

### P1-6. Không skip link, không `<main>` trên 12/13 loại trang

Skip link và `<main id="main-content" tabindex="-1">` chỉ tồn tại trong `_layouts/landing.html:9,22`. `_layouts/default.html`, `novel.html`, `novel-home.html` đều không có. Xác minh trên 13 trang build: `main` landmark = 1 trên `index.html`, **0 ở mọi trang khác**.

Đáng nói hơn: JS dùng chung ở `_includes/scripts.html:22-23, 244-250` query `.skip-link` và `#main-content` trên mọi trang và không tìm thấy gì ở 12/13. Hạ tầng viết đúng, chỉ là chưa được chuyển vào layout dùng chung.

Block bị bỏ qua gồm 8 control focusable, lặp lại ở mọi lần điều hướng — nặng nhất với đúng persona điều hướng nhiều nhất: người đọc truyện bấm "Sau →" qua 219 chương. (WCAG 2.4.1, Level A)

### P1-7. Tiêu đề bài trên `/topics/` tràn viewport 176px rồi bị cắt câm

`_includes/topic-year-list.html:11` có inline `style="white-space: nowrap;"`. Đo ở viewport 375px: 14 element vượt viewport, mép phải xa nhất **551px** — "Liveness: chống giả mạo trong nhận diện khuôn mặt" rộng 451px trong khung 375px.

Vì `html { overflow-x: clip }` (`_homepage-refresh.scss:4`) và `body { overflow-x: hidden }`, phần đuôi bị **cắt mất, không cuộn tới được, không select được**. Đây là index bài chính của site và tiêu đề tiếng Việt thì thường dài.

### P1-8. Code block không đọc được trên ba theme sáng

Màu Rouge token trỏ vào page-palette token (`--fg-dim`, `--amber`, `--phosphor`, `--fg-faint`) trong khi `--code-bg` giữ near-black ở mọi theme.

| Token | security | aviation | electronics | photography | reading |
|---|---|---|---|---|---|
| operator/punctuation | 7.03 | 8.19 | 9.48 | **2.22** | **2.23** |
| string | 12.14 | 12.54 | 11.06 | **3.08** | **2.52** |
| keyword | 10.56 | 12.18 | 11.40 | **3.72** | **3.05** |
| comment | 4.00 | 4.57 | 5.42 | **3.87** | **3.72** |

Có thật, không phải giả định: post không set `theme:` front matter nên render **không** `data-theme-lock`, và lựa chọn theme lưu trong localStorage áp lên chúng. Người đọc chọn photography hoặc reading sẽ xem mọi bài nặng code qua bảng màu hỏng. `reading` là theme của 220 chương truyện, và chương truyện có chứa `.highlight` (đo được 2 block mỗi chương).

### P1-9. `/topics/` ship 2.5 MB ảnh nền trang trí; `/photography/` ship 1.8 MB JPEG chưa tối ưu

| Trang | Requests | Transfer | Asset lớn nhất |
|---|---|---|---|
| `/topics/` | 14 | **2,710 KB** | `pic01.jpg` 2,511,986 B @ 4000×2666 |
| `/photography/` | 16 | **1,787 KB** | `banner.jpg` 837,365 B @ 2521×1584 |

`pic01.jpg` gấp ~10 lần kích thước cần cho header 375px, và vì là `background-image` nên không bao giờ lazy-load hay `srcset` được. Toàn bộ `images/` là **80 MB / 168 file**, trong đó chỉ **2 file WebP** — cả hai đều nằm trong `images/generated/` và đều làm đúng (đúng kích thước, có `width`/`height`/`loading`/`decoding`/`fetchpriority`, alt thật). 5/6 thẻ `<img>` trên `/photography/` thiếu `width`/`height`.

### P1-10. Trang world giấu toàn bộ công việc 2026 của tác giả

`_pages/aviation.html` hard-code danh sách 8 link, tất cả đều là bài 2020–2022. Bốn bài aviation viết năm 2026 (METAR/TAF, ILS, turboprop vs turbofan, thrust vectoring) **không được link từ `/aviation/`**. `_pages/electronics.html` hard-code 3 dòng; bốn bài electronics 2026 cũng vắng mặt, và một trong ba dòng ("Milvus") thực ra được phân loại `ai-ml`, mâu thuẫn với `/topics/`.

Đây là đích đến của hai trong năm mục nav chính. Khách đi theo đúng cấu trúc mà site tự quảng cáo sẽ được xem sản phẩm 2020 và không thấy gì của 2026.

### P1-11. Màu accent của 5 world hard-code ở bốn nơi, ba giá trị đã trôi lệch nhau

| world | `.world-card` / `.bridge-*` | `#menu .menu-worlds` | `.instr` |
|---|---|---|---|
| security | `oklch(82% 0.15 150)` | giống | giống ✓ |
| aviation | `oklch(80% 0.13 215)` | giống | **`oklch(83% 0.145 210)`** |
| electronics | `oklch(80% 0.12 80)` | giống | **`oklch(82% 0.135 82)`** |
| photography | `oklch(58% 0.18 25)` | giống | **`oklch(60% 0.19 26)`** |
| reading | `oklch(55% 0.09 55)` | **`oklch(70% 0.10 55)`** | **`oklch(72% 0.13 45)`** |

Vì theme-independent nên chúng hỏng trên trang sáng: homepage không theme-lock, nên người dùng cycle sang photography sẽ thấy glyph world-card ở security **1.45:1**, aviation **1.58:1**, electronics **1.66:1** (so với 10.4–11.9:1 trên theme tối).

### P1-12. Đường tuyển dụng hỏng ba nhánh

- `/cv.pdf` được publish trong build nhưng **không được link từ đâu cả** (grep `_pages`/`_layouts`/`_includes` = 0).
- **Không có `@media print` ở bất kỳ đâu.** In `/resume/` cho ra `--fg` ≈ `#dfe4e0` trên giấy trắng — gần như vô hình, vì browser mặc định không in background.
- `/works/` là `<table>` 4 cột **không `<thead>`/`<th>`**, hai dòng, cả hai là thực tập 2018 — trong khi resume ngay cạnh khai 2020–present.

### P1-13. `lang="vi-VI"` sai chuẩn và sai nội dung

`VI` là mã region của **U.S. Virgin Islands**. Đúng phải là `vi-VN` hoặc `vi`. Tệ hơn: homepage, `/resume/`, `/works/`, `/log/`, `/topics/`, `/contact/`, `/404`, toàn bộ chrome và các trang world đều **viết bằng tiếng Anh** nhưng khai là tiếng Việt. Xác minh: đúng một `lang` attribute mỗi trang, **không `lang` trên bất kỳ element con nào** trong cả 13 mẫu. (WCAG 3.1.1 Level A + 3.1.2 Level AA)

### P1-14. Header landing trong suốt vĩnh viễn trên ảnh cuộn qua

`#header.alt { background: transparent; }` (`main.scss:599`), áp khi `page.layout == 'landing'`. Handler gỡ `.alt` khi cuộn nằm ở `js/main.js:82-93` — **file này không bao giờ được load**: `index.html` không emit một `<script src>` nào. Nên header không có nền suốt toàn bộ hành trình cuộn, trong khi ảnh `.wc-visual` cao 34–49rem đi thẳng dưới chữ header. Contrast ở đó không kiểm soát được.

### P1-15. Touch target dưới sàn WCAG 2.2 AA 24×24

Đo ở 375px: `/topics/` có **44 target dưới 24px**; `#theme-cycle` co lại còn **24.5 × 44px** (`main.scss:1508` ẩn `.ts-label` dưới 736px) — control của tính năng đầu bảng của site. Footer `Credits` cao 15px. Link chương `Mục lục` 66 × 19.6px.

Code *đã* set `min-height: 44px` cho theme button, menu toggle, close button, menu link — ý định rõ ràng. Thiếu là chiều rộng và các link dạng body-copy.

---

## P2 — Đáng sửa

- **Component "instrument" báo số sai.** `/log/` hiện `novel ch. 221` (thật: 219 — collection có 221 file, 2 file là `feed.xml` và `index.html`). Cùng strip đó hiện `ch. this month 221` vì chương không có `date` nên `chapters_this_month` fallback về tổng. Homepage nói "221 chapters / ongoing serial" trong khi `_data/novels.yml` ghi `status: Hoàn thành`. Dot `--status-live` xanh + pulse đứng cạnh chữ "Hoàn thành". METAR strip pulse dot "live" trên một chuỗi hard-code `VVTS 301230Z`. Nguyên tắc 1 nói instrument cosplay đánh mất uy tín với đúng nhóm khán giả này — và nhóm này kiểm tra số. **Gauge sai tệ hơn không có gauge.**
- **Theme cycler làm vô hình một phần homepage.** `_homepage-refresh.scss:260-273` hard-code `oklch(96% 0.01 80)` cho `.hero-ledger dd`. Dưới photography/reading (`--bg` ≈ 95.5–96.5% L) nó đo **1.01:1**. Ledger chỉ ẩn dưới 980px, nên đây là lỗi chỉ xảy ra trên desktop — đúng ngữ cảnh "màn hình lớn" mà brand nhắm tới.
- **CSS ship không minify + sourcemap 137 KB publish công khai.** `sass: style: compressed` bị comment ở `_config.yml:122`; jekyll-sass-converter 3.x không còn tự compress khi production. Kết quả: `main.css` 113,667 B raw / 23,572 B gzip, kèm `main.css.map` 137,452 B. Thêm nữa `@import 'vendor/disqus.css'` ở dòng 7 emit nguyên văn thành dòng 2 của output → một round-trip render-blocking nối tiếp cho **31 byte**.
- **Google Fonts: 81 `@font-face` cho 5 family, tối đa 2 có thể dùng cùng lúc.** 32,992 B CSS render-blocking. **31/81 block (38%) là cyrillic/greek/thai** cho một site không bao giờ render các script đó. URL xin weight `500` cho cả 5 family trong khi CSS chỉ khai `400` (×1), `600` (×8), `700` (×17).
- **`color-scheme` không khai ở đâu cả.** Scrollbar và form control của browser vẫn sáng trên ba theme tối. Sáu dòng là xong.
- **FOUC theme trên máy yếu.** Theme lưu chỉ áp trong `DOMContentLoaded`. Đo với CPU throttle 6×: FCP 120ms, theme áp lúc 186ms → 66ms hiển thị sai palette, rồi cross-fade 300ms vì `--theme-fade` trên `body`.
- **`aria-label` đặt trên `<div>` không có role** ở `_pages/aviation.html:22`, `electronics.html:23`, `photography.html:30` — ARIA bỏ qua label. Trong khi `_includes/instrument-strip.html:10` làm **đúng** bằng `<section aria-label>`.
- **`<h5>` và `<br>` là con trực tiếp của `<ul>`** (`_includes/topic-year-list.html:6-9`) — HTML không hợp lệ, phá cấu trúc list. Trên chính index có traffic cao nhất của một site mà nguyên tắc số 4 là "cách site được dựng chính là mẫu code".
- **Heading skip:** `/topics/` đi h1 → h4 → h5; `/log/` đi h1 → h3.
- **Menu toggle là `<a>` đóng vai `<button>`** — kích hoạt bằng Enter nhưng không bằng Space, dù có `aria-expanded`.

---

## P3 — Dọn dẹp

- **520 MB `pts/` đang deploy lên GitHub Pages.** Xác minh live: `/pts/compress.psd` trả HTTP 200, **14,498,617 byte** file Photoshop. `/pts/Updater.py` trả 200 dạng octet-stream. `/pts/rsrc/fonts/fs/` chứa 6 file OTF từ 4–10 MB. Cộng `idmm/` 68 KB, `/heart.html` (một trang CodePen sao chép nguyên văn, title vẫn là "CodePen - 3D Particle Heart"), `/_pages/covid19.html` (iframe dashboard COVID 2020). **Đã quét: không có credential nào lộ ra** — đây là vấn đề vệ sinh và dung lượng, không phải sự cố bảo mật. Pages có hạn mức 1 GB; site đang dùng quá nửa cho rác.
- 6 file JS không được reference nào publish (~145 KB): `hero-scene.js`, `jquery.min.js`, `skel.min.js`, `util.js`, `main.js`, `jquery.scrolly/scrollex`.
- CSS chết: `.hero-metrics` (29 dòng, 0 trang dùng), `[data-theme='aviation-chart']` (24 dòng, 0 trang dùng, và `--fg-dim` của nó đo 2.25:1 do copy nhầm lightness của theme tối).
- CSS thiếu: `.notfound`, `.nf-sub`, `.nf-actions` — **toàn bộ thân trang 404 không có rule nào**. Trang 404 là paragraph mặc định không style, một action, không search.
- Token `--surface-3` khai 6 lần, đọc **0 lần**.
- `soundcloud: soundcloud.com/hoang6969/` trong `_config.yml` thiếu scheme → footer emit nguyên văn thành href tương đối → 404 trên mọi trang.
- `sitemap.xml` liệt kê 58 URL trong khi build ra 277 trang — 221 trang chương vắng mặt.
- Transition trên layout property: `padding-left` ở `main.scss:1009`, `:1058`, `:2572` (hover-only, chi phí nhỏ nhưng là chỗ duy nhất animate layout).

---

## Cognitive load: 4 điểm trượt → CRITICAL

| Điểm quyết định | Số lựa chọn hiện | Verdict |
|---|---|---|
| Header cố định (mọi trang) | 8 | **TRƯỢT** — hai hệ nav song song (world-nav *và* Menu) cùng hiện, cùng dẫn tới 5 world dưới hai nhãn khác nhau ("01 Systems" vs "Security & Systems") |
| Menu trượt | 12 | **TRƯỢT**, có giảm nhẹ nhờ progressive disclosure và nhãn nhóm |
| `/topics/` | ~43 dòng, không search/filter/tag | **TRƯỢT** — mật độ là tính năng, nhưng mật độ không có bộ lọc thì không phải nhịp điệu |
| Footer (mọi trang) | 9 | **TRƯỢT** |
| Hero | 3 | Đạt |
| Chương truyện | 3 (Trước / Mục lục / Sau) | Đạt — điểm quyết định tốt nhất site |

---

## Emotional journey: đỉnh đạt, kết thúc trượt

90 giây đầu đúng ý đồ: hero atlas, dòng tên viền outline, năm world row full-bleed với ghost numeral — đọc ra là *được bố cục*, không phải được trang trí. Đỉnh là bước vào `/aviation/` hoặc `/electronics/` và thấy một attitude indicator vẽ tay thật sự trôi theo pitch và roll.

Rồi nó đi xuống, đơn điệu. Logbook của cockpit là tám link từ 2020. Topics index là bức tường `[dd Mon]` dưới h4/h5 với một rổ "Khác" tiếng Việt trên trang chrome tiếng Anh. Bài viết em vào đọc có bảy heading cỡ tiêu đề và không có bản đồ. Và điều cuối cùng site nhờ em làm — "Let's talk. My inbox is open." — dẫn tới một form có ô captcha trắng không submit được.

**Peak-end: đỉnh đạt, kết thúc trượt.** Đây là sắp xếp tệ nhất có thể — site tiêu uy tín vào hero rồi đánh mất nó ở cái bắt tay.

---

## Nielsen chi tiết

| # | Heuristic | Điểm | Vấn đề chính |
|---|---|---|---|
| 1 | Visibility of system status | 2 | Component có mỗi việc là báo trạng thái thì báo sai: "ch. this month 221", METAR pulse dot trên observation đóng băng, "ongoing" xanh cạnh "Hoàn thành" |
| 2 | Match system / real world | 3 | Decode METAR và hình học ADI là domain work đúng; nhưng body copy là mono trong gallery lẫn cockpit, và `lang="vi-VI"` không phải BCP-47 hợp lệ |
| 3 | User control and freedom | 2 | ← / → toàn cục nhảy sang bài khác trên mọi post, không có affordance; theme cycler chỉ đi một chiều; không skip link trên 12/13 loại trang |
| 4 | Consistency and standards | 2 | 2 h1 mọi trang + 6–15 h1 mỗi post; h1→h4→h5 trên `/topics/`; `<br>`+`<h5>` làm con của `<ul>`; class `12u`/`6u$` không stylesheet nào định nghĩa; 221 vs 219 |
| 5 | Error prevention | 1 | Form bảo "Type the numbers you see" cạnh `<img src="">`, rồi submit về `action=""`. Không ngăn, không cảnh báo, không giải thích |
| 6 | Recognition rather than recall | 2 | Breadcrumb, `aria-current`, accent theo world đều tốt; nhưng số `01…05` render 1.68:1 và điều hướng bằng phím mũi tên là recall thuần |
| 7 | Flexibility and efficiency | 2 | Bookmark đọc + "Đọc tiếp" xuất sắc. Nhưng Pagefind chỉ scope truyện — 43 bài kỹ thuật không search, không tag, không related |
| 8 | Aesthetic and minimalist design | 3 | Atlas cover, world row, cột đọc, hai canvas instrument đều tự tin và bố cục tốt |
| 9 | Error recovery | 1 | 404 không style, một action, không search; contact success/failure tồn tại nhưng không tới được vì POST không bao giờ xảy ra |
| 10 | Help and documentation | 2 | Không chỗ nào giải thích năm world là gì, nút theme làm gì, phím mũi tên điều hướng post, số trên instrument nghĩa gì. Tài liệu tốt nằm trong source comment — cho tác giả |

---

## Detector: 369 findings, đã lọc

| Pattern | Count | Adjudication |
|---|---|---|
| `undersized-ui-text` | 137 | **THẬT** — một nguyên nhân gốc: `.world-nav a { font-size: 0.68rem }` = 10.88px. Cả ba nhánh độc lập cùng chỉ vào component này |
| `pulsing-dot` | 65 | **Nửa thật** — kỹ thuật thì restraint tốt (1 infinite animation/trang, chỉ opacity+transform). Vấn đề thật là *ngữ nghĩa*: dot "live" đặt trên dữ liệu tĩnh |
| `dark-glow` | 59 | **FALSE POSITIVE** — glow là chữ ký thương hiệu có chủ đích, áp bằng một block selector liệt kê duy nhất, không bao giờ chạm body text |
| `cramped-padding` | 22 | Đáng xem, không cấp bách |
| `low-contrast` | 19 | **THẬT** — nhánh a11y tính lại độc lập và xác nhận, chi tiết hơn nhiều |
| `codex-grid-background` / `repeating-stripes-gradient` | 27 | **FALSE POSITIVE** — CRT scanline / grid ambient có chủ đích, 5% và 4.5% alpha |
| `flat-type-hierarchy` | 12 | **Một phần FP** — detector chỉ đo dải chrome nhỏ, không thấy hero clamp. Nhưng chrome *có* phẳng thật |
| `cream-palette` | 3 | **FALSE POSITIVE** — photography và reading là light world cố ý |
| `low-contrast 1.0:1` trên `/resume/` | 1 | **FALSE POSITIVE nhiều khả năng** — `.cv-prompt` có `text-shadow: 0 0 0.45em var(--glow-soft)` cùng hue với `color: var(--phosphor)`; detector nhiều khả năng composite shadow thành background. Nhánh a11y quét contrast toàn diện và **không** báo lại chỗ này |
| `broken-image` | 1 | **THẬT, đã xác minh production** |
| `em-dash-overuse` | 2 | Advisory, bỏ qua — 84 em-dash trong một chương tiểu thuyết là văn phong |

---

## Ba mẫu hình hệ thống

**1. Giá trị identity không phải là `none`.** P0-1 sinh ra từ một keyframe kết thúc ở `scale(1)` / `brightness(1)` dưới `fill-mode: both`. Về mặt thị giác đó là no-op; về mặt cấu trúc nó đổi vĩnh viễn containing block của mọi descendant fixed. Một sai lầm duy nhất, tác động cao nhất toàn bộ audit, và nó lọt lưới **chính vì trang trông y hệt**.

**2. Reduced-motion mới là bản build đúng.** `* { animation: none !important }` + `#page-wrapper { transform: none; filter: none }` vô tình tạo ra site chạy đúng. Nghĩa là mọi lượt QA thủ công làm với reduced-motion bật — một thói quen kiểm thử a11y phổ biến — sẽ thấy header dính hoàn hảo.

**3. Bề mặt component vs bề mặt trang.** Code block cố ý giữ nền tối trên cả 6 theme, nhưng màu chữ của nó lấy từ page-palette token. Bất kỳ component nào tự ghim surface độc lập với `--bg` đều cần bộ foreground token riêng. Đây cũng là lý do `--status-live` (xanh cố định trên nền trang biến thiên) rơi xuống 2.1:1 trên giấy.

Phụ: **che triệu chứng thay vì sửa overflow** (`html { overflow-x: clip }` + `body { overflow-x: hidden }` khiến lỗi tràn ở `/topics/` sống sót — không có gì cuộn, không có gì trông hỏng, chữ chỉ đơn giản là biến mất); và **cùng một giá trị copy ra bốn chỗ rồi sửa một chỗ** (5 world accent, 3/5 đã trôi lệch).

---

## Làm tốt thật sự

- **Canvas hero được engineer đúng chuẩn.** rAF pause theo IntersectionObserver và `document.hidden`, DPR cap 2, resize debounce qua rAF, static frame khi reduced-motion, bọc try/catch với comment "fail silent — the hero is decorative".
- **Kỷ luật animation đo được.** Đúng **một** infinite animation mỗi trang, trên một dot 0.55em, chỉ `opacity` + `transform`. Với một site có CRT scanline, phosphor bloom, film grain, EFIS và PCB hero, đó là kỷ luật đáng nể.
- **Không layout thrash ở bất kỳ đâu.** 341 dòng JS trong `scripts.html` cộng hai file hero cộng script reading-progress — không một read-then-write nào trong loop, scroll handler hay rAF callback. Listener đều `{passive:true}` và rAF-coalesce.
- **0 hex, 0 `rgb()`, 0 tên màu** trên 3575 dòng stylesheet; palette 19 token đầy đủ ở cả sáu theme.
- **`prefers-reduced-motion` phủ gần như hoàn hảo** — 9 media block + global override + matchMedia guard trong JS. Không tìm thấy animation nào không được phủ.
- **Menu trượt là một modal dialog dựng đúng.** `inert` toggle cùng `aria-hidden`, focus trap, Escape, khôi phục focus **đúng thứ tự** (gỡ `inert` trước khi restore), `aria-expanded` đồng bộ. Tốt hơn phần lớn menu tự viết.
- **Focus ring theme-aware, đạt 3:1 ở mọi palette** — đo 4.69–12.22:1, dùng `:focus-visible`.
- **Alt text ảnh photography thật sự tốt.** "A waterfront row of old houses mirrored in perfectly still water at blue hour" — không phải tên file, không "image of", không nhồi keyword.
- **`aria-current` dùng đúng cả sắc thái page/location** — thứ đa số site làm sai.
- **Thang type fluid thật sự scale được theo người dùng.** Mọi `clamp()` dùng rem cho *cả hai* bound; đặt root 32px thì header nở 48 → 104px đúng.
- **Thế giới reading là bằng chứng rõ nhất tác giả phân biệt được trang trí và chức năng.** Đây là world duy nhất bỏ mono: Spectral 1.15rem/1.85 trong cột 38rem, progress bar chỉ animate `transform`, bookmark localStorage throttle nổi lại thành "Đọc tiếp · Chương N". Một power-user feature, đúng cái mà người đọc truyện dài thật sự cần, và không gì khác.
- **Công việc mới tốt hơn công việc cũ.** `images/generated/*.webp` làm đúng mọi thứ. Vấn đề tụ ở bề mặt kế thừa: cơ chế `background-image` thời HTML5UP, bundle jQuery không dùng, `_pages/contact.html`, `_includes/topic-year-list.html`.

---

## Bốn câu hỏi đáng nghĩ

1. **Nếu xoá world security ngày mai và mở site bằng aviation, brand mất gì — hay nó sắc hơn?** Terminal-phosphor-xanh là world duy nhất mà một model sẽ tự sinh ra từ brief của em. EFIS và PCB là hai thứ nó sẽ không. Em đang để câu trả lời phản xạ làm mặc định và để tác phẩm gốc làm thứ phải click vào.

2. **Tại sao body copy là monospace trong darkroom và trong cockpit?** Nhãn tường gallery thật là serif tỷ lệ; readout EFIS thật là sans condensed; silkscreen thật là sans condensed. Nguyên tắc 1 nói chi tiết sai đánh mất uy tín với đúng khán giả của em — và mono-khắp-nơi là chi tiết sai lớn nhất trên site. Thế giới reading đã chứng minh em sẵn sàng phá lệ khi nội dung đòi.

3. **Ba trang world dùng chung một skeleton: hero → status strip → link list → field log. `/aviation/` sẽ trông thế nào nếu nó được bố cục như một cuốn logbook thật** — dòng có ngày, giờ bay, loại máy bay, ghi chú, xếp cột — thay vì một hero với link bên dưới? Nội dung đã có sẵn trong `_posts` và `_log`. Chỉ cái container là generic, và container chính là thứ tạo ra cảm giác "cùng skeleton, đổi biến".

4. **Instrument strip là tuyên bố trung thực rõ ràng nhất của em, và nó đang báo 221 chương khi thực có 219, và "221 tháng này". Nó có nên fail closed không?** Một gauge render fallback thay vì không render gì là một gauge nói dối lặng lẽ. Nếu `metrics_generator.rb` không suy ra được con số trung thực, thì không hiện gauge có on-brand hơn hiện gauge sai không — và nguyên tắc đó có tổng quát hoá sang METAR strip, các status dot, và nhãn "ongoing serial" không?

---

## Câu hỏi chưa giải quyết

- Có chủ đích để `pts/` và `idmm/` phục vụ công khai không, hay chúng là di tích cần xoá khỏi build? 520 MB là quá nửa hạn mức GitHub Pages.
- `_data/tokens.yml` có nên được cam kết (chỉ phần không nhạy cảm) hay luồng contact nên chuyển hẳn sang một dịch vụ form không cần token?
- Homepage nên theme-lock vào `security`, hay nên có atlas hero riêng cho từng theme? Hiện nó không lock nên hai trong năm state làm hỏng ledger.
- `aviation-chart` là công việc đang dở hay là code chết nên xoá?

---

## Trạng thái sau lần sửa này (2026-09-04)

Đã sửa **ba P0**, theo đúng phạm vi được chốt. Không đụng P1/P2/P3. Không commit, không push.

### P0-1 — Header và menu không fixed theo viewport · ĐÃ SỬA

`css/main.scss` — keyframe `crt-power-on` kết thúc ở `transform: none; filter: none` thay vì giá trị identity, và `animation-fill-mode` đổi từ `both` → `backwards` để fill không tồn tại sau khi animation kết thúc.

Verify bằng headless Chrome (CDP) trên 5 trang, ở `scrollY=1200`, **motion bật**:

```
CONTROL (tiêm lại keyframe cũ):  headerTop=-1200  transform=matrix(1,0,0,1,0,0)  -> bug tái hiện
landing /       headerTop=0  transform=none  filter=none   PASS
topics          headerTop=0  transform=none  filter=none   PASS
aviation        headerTop=0  transform=none  filter=none   PASS
photography     headerTop=0  transform=none  filter=none   PASS
novel chapter   headerTop=0  transform=none  filter=none   PASS
```

Control quan trọng: nó chứng minh phép kiểm tra *có thể* fail, nên kết quả PASS mới có nghĩa.

### P0-2 — Form contact chết · ĐÃ SỬA

`_pages/contact.html` viết lại theo hướng fail closed. `css/main.scss` thêm block `/* ---------- Contact ---------- */`.

- Form chỉ render khi `site.data.tokens.mailaction` tồn tại. Không có endpoint thì trang hiển thị ba tuyến liên hệ trực tiếp (email / GitHub / LinkedIn) thay vì một control không hoạt động.
- Ảnh captcha chỉ render khi có `captchascript`, kèm `alt` chỉ đường sang tuyến email.
- Thêm `<label for>` cho cả 5 field, `autocomplete="name"` / `"email"`.
- Bỏ `jquery.validate.min.js` và lời gọi `$(...)` — jQuery core không được load nên script ném `ReferenceError`. Validation dựa vào `required` / `type=email` / `minlength` của HTML5.
- Thay class grid HTML5UP chết (`row uniform` / `6u` / `12u$`) bằng `.contact-grid` thật.
- Link `mailto:` luôn hiện ở cả hai nhánh.

Verify: build cả hai nhánh (một lần với `_data/tokens.yml` tạm, đã xoá ngay sau đó). Trên bản không có token: `action=""` 0 lần, `<img src=""` 0 lần, `jquery.validate` 0 lần, `12u` 0 lần, không `<script src>` nào trên trang.

### P0-3 — 6–15 thẻ `<h1>` mỗi bài · ĐÃ SỬA

Hạ cấp heading thân bài đi một mức trên **38 file** có body h1 (**291 heading**). Ba file không có body h1 giữ nguyên để không tạo level skip: `2018-05-01-works-newai.md`, `2018-12-01-works-dps.md`, `2019-10-08-about-me.md`.

Script hạ cấp nhận biết code fence: **50 dòng bắt đầu bằng `#` nằm trong code block** (comment shell/Python) không bị đụng tới. Kiểm chứng bằng `git diff`: 582 dòng nội dung thay đổi, **582/582 đều là dòng ATX heading, 0 dòng khác**.

Chống tái phát: `.inner.post-body h1 { font-size: var(--fs-h2); }`, với `post-body` thêm vào `_layouts/post.html`.

Kết quả đo trên 38 trang bài: **tối đa 2 thẻ `<h1>` mỗi trang** (site title ở `#header` + tiêu đề bài ở `header-inner`), xuống từ 9–17. Nhịp h2/h3 thật đã xuất hiện.

**Một regression tự gây ra, đã bắt và sửa:** guard ban đầu viết là `.wrapper.style5 .inner h1`, nhưng `_layouts/page.html` dùng chung đúng shell đó, nên nó thu nhỏ luôn hero headline của các trang world. Thu hẹp lại thành `.inner.post-body` và verify bằng đo `font-size` thật:

```
world hero photography   96.0px  "Frames I kept from the light."   PASS
aviation hero            96.0px  "Wings level, heading west."      PASS
article stray            không còn                                  PASS
article title            57.6px                                     PASS
```

### Đối chiếu detector trước/sau

369 → 368. `broken-image` 1 → 0. Một finding mới `cramped-padding` trên `/contact/` là **false positive**: nó đo `.wrapper` so với `.inner` và đã báo cùng kiểu trên `/aviation/` từ trước; ảnh chụp thật cho thấy section có padding rộng rãi.

Các nhóm còn lại không đổi (`undersized-ui-text` 137, `dark-glow` 59, `pulsing-dot` 65) — đúng như dự kiến, vì đó là P1 và các lựa chọn có chủ đích, không nằm trong phạm vi lần này.

### Còn nguyên, chờ quyết định

Toàn bộ P1/P2/P3 ở trên. Đáng chú ý nhất: `--fg-faint` trượt AA cả 6 palette, số world-nav 1.48–2.24:1, tràn ngang `/topics/`, ảnh 2.5 MB, code block trên theme sáng, link list hard-code giấu bài 2026, 520 MB `pts/`.

Ghi chú: body copy monospace ở cả 5 world đã được xác nhận là **chủ đích thiết kế**, không phải lỗi. Đã loại khỏi mọi danh sách cần sửa.

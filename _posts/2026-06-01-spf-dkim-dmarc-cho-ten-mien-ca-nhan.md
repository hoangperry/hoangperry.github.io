---
title: SPF, DKIM, DMARC cho một tên miền cá nhân
excerpt: "Chống giả mạo email đầu-cuối: triển khai đầy đủ ba lớp xác thực cho một domain của riêng bạn."
permalink: /topics/spf-dkim-dmarc-cho-ten-mien-ca-nhan/
categories:
  - topics
  - security
date: 2026-06-01 09:00
---


*Ba bản ghi DNS nhỏ, ba lớp niềm tin chồng lên nhau, đủ để một tên miền cá nhân thôi bị mạo danh.*

# Vì sao email lại dễ bị giả mạo?

Về lý thuyết, **SMTP** (Simple Mail Transfer Protocol), giao thức mà cả thế giới dùng để gửi email, được thiết kế từ năm 1982 trong một thế giới mạng nhỏ và tin nhau. Nó không có bất kỳ cơ chế nào để kiểm tra xem người gửi có thực sự là người mà họ tự xưng hay không. Cụ thể, trường **From:** mà chúng ta nhìn thấy trong hộp thư chỉ là một dòng text do bên gửi tự điền vào. Không có gì ngăn tôi mở một kết nối SMTP và khai báo mình là `ceo@ngan-hang-cua-ban.com`.

Đây chính là gốc rễ của **email spoofing** và phần lớn các chiến dịch **phishing**. Ba giao thức chúng ta sẽ bàn hôm nay, **SPF**, **DKIM** và **DMARC**, được sinh ra để vá lỗ hổng niềm tin đó mà không cần thay đổi bản thân SMTP. Chúng hoạt động như những lớp chứng thực chồng lên nhau, đặt trong **DNS**, để bên nhận có thể tự hỏi: "email này có đúng là đến từ hạ tầng được phép gửi thay cho domain này không?".

Một chi tiết quan trọng cần nắm ngay từ đầu: có tới hai địa chỉ người gửi trong một email. Một là **envelope sender** (còn gọi là **MAIL FROM** hay **Return-Path**), dùng trong quá trình vận chuyển. Hai là **header From:**, cái mà người dùng thực sự nhìn thấy. SPF kiểm tra cái thứ nhất, còn DMARC quan tâm cái thứ hai. Nhầm lẫn giữa hai địa chỉ này là nguồn gốc của rất nhiều cấu hình sai.

# SPF: ai được phép gửi thay cho tôi?

**SPF** (Sender Policy Framework, RFC 7208) trả lời một câu hỏi đơn giản: những địa chỉ IP nào được phép gửi email cho domain của tôi? Chủ domain công bố một danh sách trong một bản ghi **TXT** trên DNS. Khi một mail server nhận email, nó lấy domain trong envelope sender, tra bản ghi SPF, rồi so IP thực tế của bên gửi với danh sách đó.

Với một domain cá nhân dùng, ví dụ, một nhà cung cấp email nào đó, bản ghi có thể trông như thế này:

```dns
example.com.  IN  TXT  "v=spf1 include:_spf.google.com include:sendgrid.net -all"
```

Đọc từ trái sang phải:

1. `v=spf1` là phiên bản, bắt buộc.
2. `include:...` nói rằng "hãy tin cả danh sách IP mà domain kia công bố". Ta dùng cái này thay vì liệt kê IP thủ công, vì nhà cung cấp có thể đổi IP bất cứ lúc nào.
3. `-all` ở cuối là phần quan trọng nhất. Nó nghĩa là "mọi nguồn khác không nằm trong danh sách trên đều FAIL". Dấu `-` là **hard fail**. Nếu dùng `~all` (dấu ngã) thì là **soft fail**, tức "đáng ngờ nhưng vẫn nhận".

Có vài cạm bẫy thực tế cần nhớ. SPF có giới hạn cứng **10 lần tra cứu DNS** (mỗi `include`, `a`, `mx`, `redirect` đều tính). Vượt quá là kết quả trả về **permerror** và coi như SPF hỏng. Vì vậy đừng nhồi năm sáu `include` vào một domain cá nhân. Điểm yếu lớn thứ hai: SPF kiểm tra envelope sender, không phải header From: mà người dùng thấy. Cho nên chỉ riêng SPF không hề chống được kẻ giả mạo trường From: hiển thị. Và điểm yếu thứ ba: SPF vỡ khi email được **forward**, vì máy chủ trung gian gửi lại bằng IP của chính nó, một IP không nằm trong danh sách.

# DKIM: chữ ký số cho từng lá thư

**DKIM** (DomainKeys Identified Mail, RFC 6376) tiếp cận vấn đề theo hướng mật mã học. Thay vì hỏi "IP này có được phép không", DKIM gắn một **chữ ký số** vào phần header của mỗi email. Máy chủ gửi giữ **private key**, còn **public key** được công bố trên DNS. Bên nhận lấy public key, xác minh chữ ký, và nếu khớp thì chắc chắn hai điều: email thực sự do domain đó ký, và nội dung (các header và body được ký) không bị sửa trên đường đi.

Chữ ký nằm trong một header tên `DKIM-Signature`, đại khái:

```text
DKIM-Signature: v=1; a=rsa-sha256; d=example.com; s=mail2026;
  h=from:to:subject:date; bh=<hash cua body>;
  b=<chu ky so>...
```

Trong đó `d=` là domain ký, `s=` là **selector**. Selector cho phép một domain có nhiều cặp khóa song song (ví dụ cho nhiều dịch vụ gửi khác nhau, hoặc để xoay vòng khóa). Public key tương ứng nằm ở:

```dns
mail2026._domainkey.example.com.  IN  TXT  "v=DKIM1; k=rsa; p=<public key base64>"
```

Ưu điểm lớn của DKIM so với SPF là nó **sống sót qua forward**, vì chữ ký đi kèm nội dung chứ không phụ thuộc IP. Nhược điểm: nếu một máy chủ trung gian sửa nội dung (thêm dòng quảng cáo footer, sửa charset, gắn thẻ mailing list), chữ ký sẽ vỡ. Với domain cá nhân, lời khuyên thực tế là dùng khóa **RSA 2048-bit** (1024-bit đã bị coi là yếu), và nếu tự vận hành thì nên đặt lịch **xoay selector** định kỳ, ví dụ mỗi năm một lần.

# DMARC: dán hai mảnh lại và ra chính sách

Đây là mảnh ghép làm cho hai cái trên trở nên có ý nghĩa. **DMARC** (Domain-based Message Authentication, Reporting and Conformance, RFC 7489) làm ba việc.

Thứ nhất, nó buộc kết quả SPF hoặc DKIM phải **alignment** với header From: mà người dùng nhìn thấy. Nhớ lại rằng SPF kiểm tra envelope sender, DKIM kiểm tra `d=`. Kẻ tấn công hoàn toàn có thể có một email pass SPF cho domain rác của hắn, nhưng lại đặt From: là domain của bạn. DMARC chặn đúng trò này: nó yêu cầu domain đã pass (qua SPF hoặc DKIM) phải trùng với domain trong From:. Chỉ cần **một trong hai** align là email đạt DMARC.

Thứ hai, nó cho chủ domain công bố một **chính sách** về việc phải làm gì khi một email không đạt: `none` (không làm gì, chỉ theo dõi), `quarantine` (đẩy vào spam), hoặc `reject` (từ chối thẳng).

Thứ ba, và đây là phần hay bị bỏ quên, DMARC cung cấp **báo cáo**. Bên nhận sẽ gửi lại cho bạn các báo cáo tổng hợp (**aggregate report**, thường gọi là **rua**) hằng ngày, liệt kê IP nào đã gửi thay cho domain bạn và kết quả xác thực ra sao.

Một bản ghi DMARC cho domain cá nhân đặt tại `_dmarc.example.com`:

```dns
_dmarc.example.com.  IN  TXT  "v=DMARC1; p=none; rua=mailto:dmarc@example.com; adkim=s; aspf=s; pct=100"
```

`adkim=s` và `aspf=s` bật chế độ **strict alignment** (domain phải khớp chính xác, không chỉ khớp phần domain gốc). `pct` là phần trăm email áp dụng chính sách, hữu ích khi triển khai từ từ.

# Trình tự triển khai cho một domain cá nhân

Cái sai lớn nhất người ta hay mắc là nhảy thẳng vào `p=reject`, rồi phát hiện một dịch vụ hợp pháp (bản tin, form liên hệ, hóa đơn) bị chặn mất. Cách an toàn là leo thang dần dần.

1. Bật **SPF** với `-all`, liệt kê đúng những dịch vụ bạn thực sự dùng để gửi.
2. Bật **DKIM** trên nhà cung cấp email chính, kiểm tra một email tự gửi cho mình xem chữ ký có `pass` không.
3. Công bố **DMARC** ở mức `p=none` kèm `rua=`. Ở giai đoạn này bạn không chặn gì cả, chỉ **quan sát** báo cáo trong vài tuần.
4. Khi báo cáo cho thấy mọi luồng gửi hợp pháp đều align sạch, nâng lên `p=quarantine`, rồi cuối cùng `p=reject`. Có thể dùng `pct=25` rồi `pct=50` để tăng dần.

Đọc báo cáo rua bằng mắt thường khá cực vì nó là XML nén. Có những dịch vụ miễn phí giúp trực quan hóa, nhưng nếu thích tự làm thì một script Python nhỏ parse XML cũng đủ dùng cho một domain cá nhân lưu lượng thấp.

# Vài suy nghĩ cuối

Điều thú vị là cả ba giao thức này đều không sửa gì trong SMTP. Chúng chỉ chồng thêm các tuyên bố có kiểm chứng lên trên một giao thức vốn cả tin, và giao phần thực thi cho bên nhận. Nghĩa là hiệu quả của chúng phụ thuộc vào việc bên nhận có chịu kiểm tra hay không. Một domain cá nhân đặt `p=reject` hoàn hảo vẫn có thể bị giả mạo tới một máy chủ nào đó không thèm đọc DMARC.

Và cũng nên thành thật: bộ ba này chống được kẻ giả mạo **chính xác domain** của bạn, nhưng không cản được **lookalike domain** (kiểu `examp1e.com` với số một), cũng không cản được display name giả. Chúng là một lớp phòng thủ rất đáng làm, gần như miễn phí, nhưng không phải viên đạn bạc. Với tôi, giá trị lớn nhất của việc triển khai đầy đủ trên một domain cá nhân không hẳn là chặn được kẻ xấu, mà là cái báo cáo rua: lần đầu tiên bạn thực sự nhìn thấy ai đang gửi email nhân danh mình.

# Tài liệu tham khảo

- RFC 7208, Sender Policy Framework (SPF), IETF.
- RFC 6376, DomainKeys Identified Mail (DKIM) Signatures, IETF.
- RFC 7489, Domain-based Message Authentication, Reporting, and Conformance (DMARC), IETF.
- RFC 5321, Simple Mail Transfer Protocol, IETF.
- M3AAWG, Email Authentication Best Common Practices.
- Wikipedia: Email authentication, DMARC, DomainKeys Identified Mail.

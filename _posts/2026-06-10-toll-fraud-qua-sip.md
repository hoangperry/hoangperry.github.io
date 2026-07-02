---
title: Giải phẫu tấn công cước lậu qua SIP
excerpt: "Vì sao một tổng đài Asterisk hở ra Internet có thể ngốn hàng nghìn đô cước quốc tế trong một đêm, và mô hình DMZ cộng auth chặn được nó thế nào."
permalink: /topics/toll-fraud-qua-sip/
categories:
  - topics
  - security
date: 2026-06-10 09:00
---

Có một loại tấn công mà nạn nhân thường không biết mình đã bị đánh cho tới khi nhận hoá đơn. Không có ransomware nhấp nháy trên màn hình, không có dữ liệu bị mã hoá, chỉ có một dòng cước điện thoại quốc tế dài bất thường về các đầu số ở những nơi chúng ta chưa từng gọi tới. Đó là **toll fraud**, hay cước lậu, và trong thế giới **VoIP** nó gần như luôn đi qua cùng một cánh cửa: một tổng đài **Asterisk** cấu hình lỏng, phơi thẳng port **SIP** ra Internet.

Bài này mình muốn mổ xẻ chuỗi tấn công đó theo đúng trình tự kẻ tấn công đi, rồi giải thích vì sao hai biện pháp cũ kỹ đến mức nhàm chán, đặt tổng đài vào **DMZ** và bắt buộc xác thực mạnh, lại là thứ chặn được phần lớn các vụ này.

# SIP là gì, và vì sao nó dễ bị nhắm

Về lý thuyết, **SIP (Session Initiation Protocol)** là một giao thức báo hiệu ở tầng ứng dụng, được mô tả trong **RFC 3261**. Nó không truyền tiếng nói. Việc nó làm là thiết lập, sửa đổi và kết thúc các phiên: gọi đi đâu, ai gọi ai, dùng codec gì, luồng thoại thật (mang bởi **RTP**) sẽ đi qua địa chỉ và cổng nào. Nói cách khác, SIP là phần lễ tân, còn RTP là phần hội thoại.

Vài đặc điểm khiến SIP thành mục tiêu ngọt:

1. Nó là **text-based**, cú pháp giống HTTP, rất dễ đọc và dễ chế tác request bằng script.
2. Mặc định nó thường chạy trên **UDP cổng 5060**, một cổng UDP mở là món quà cho việc quét hàng loạt vì không cần bắt tay ba bước như TCP.
3. Cơ chế xác thực mặc định là **Digest authentication** (kế thừa từ HTTP), dựa trên username và password. Nếu ai đó đoán được cặp này, họ hợp lệ trong mắt tổng đài.
4. Một tổng đài **PBX** theo định nghĩa là thứ được nối vào mạng thoại có tính cước. Đằng sau nó là tiền thật, tính theo phút, chảy về các nhà mạng.

Điểm cuối cùng là mấu chốt. Đánh sập một web server chỉ khiến trang die. Chiếm được một extension SIP có quyền gọi ra ngoài nghĩa là kẻ tấn công có một máy in tiền, và người trả hoá đơn là chúng ta.

# Lịch sử và động cơ: cước lậu để làm gì

Trò này không mới. Từ thời tổng đài analog, dân **phreaking** đã tìm cách gọi chùa. Nhưng VoIP biến nó thành một ngành công nghiệp có động cơ tài chính rõ ràng, thông qua thứ gọi là **IRSF (International Revenue Share Fraud)**.

Cơ chế đại khái thế này. Có những đầu số quốc tế thuộc dạng **premium rate**, cước gọi tới rất cao. Một bên trung gian ký hợp đồng ăn chia doanh thu với nhà mạng sở hữu dải số đó: cứ có cuộc gọi đến, họ được chia phần. Kẻ tấn công chỉ cần bơm thật nhiều phút gọi vào các số này, từ tổng đài của nạn nhân, rồi thu tiền chia sẻ doanh thu. Nạn nhân trả cước, nhà mạng trung gian và kẻ tấn công chia nhau khoản lời. Đây là lý do các cuộc tấn công thường nhắm vào những đầu số lạ ở các quốc gia xa xôi, và thường bùng nổ vào cuối tuần hay ngày lễ, khi không ai ngồi nhìn dashboard.

Vì có tiền thật ở cuối đường, việc quét SIP diễn ra liên tục và tự động hoá. Nếu chúng ta bật một tổng đài mới với IP public, thường chỉ trong vòng vài giờ tới vài ngày log đã đầy các lượt thăm dò từ khắp nơi.

# Giải phẫu một cuộc tấn công

Chuỗi tấn công điển hình đi qua bốn bước, mỗi bước đều để lại dấu vết đặc trưng trong log.

## Bước 1: Quét và điểm danh máy chủ

Kẻ tấn công quét dải IP để tìm cổng SIP mở. Công cụ kinh điển là **SIPVicious** với script `svmap`, hoặc đơn giản là `nmap` với option quét UDP. Cách nhận diện một máy chủ SIP là gửi một request và xem nó có trả lời theo đúng ngữ pháp SIP không.

Một request thăm dò kiểu **OPTIONS** trông như sau:

```
OPTIONS sip:100@target.example SIP/2.0
Via: SIP/2.0/UDP scanner:5061;branch=z9hG4bK-1
From: "sipvicious" <sip:100@target.example>;tag=abc
To: <sip:100@target.example>
Call-ID: 1@scanner
CSeq: 1 OPTIONS
User-Agent: friendly-scanner
Max-Forwards: 70
```

Chi tiết đắt giá ở đây là header `User-Agent: friendly-scanner`. Đó là chữ ký mặc định của SIPVicious. Trong nhiều năm nó là dấu hiệu số một để chặn: thấy `friendly-scanner` gõ cửa thì gần như chắc chắn không phải bạn bè. Dĩ nhiên kẻ tấn công có kinh nghiệm sẽ đổi header này, nên nó chỉ lọc được lớp ồn ào nhất.

## Bước 2: Điểm danh extension

Khi biết có tổng đài, việc tiếp theo là tìm xem những extension nào tồn tại. Kẻ tấn công dò lần lượt các số máy nhánh (100, 101, 200, 1000...) bằng cách gửi `REGISTER` hoặc `INVITE` và đọc mã trả về.

Điểm yếu kinh điển của cấu hình sơ sài là tổng đài phản hồi **khác nhau** cho extension tồn tại và extension không tồn tại. Ví dụ, với một số máy có thật nhưng sai mật khẩu, Asterisk trả **401 Unauthorized** (kèm thử thách xác thực). Với một số không tồn tại, nó trả **404 Not Found**. Chỉ cần so sánh mã trả về, kẻ tấn công lập được danh sách extension hợp lệ mà chưa cần đoán một mật khẩu nào. Đây là một dạng rò rỉ thông tin qua kênh phụ (**user enumeration**).

## Bước 3: Dò mật khẩu

Có danh sách extension rồi, bước còn lại là brute-force mật khẩu. SIP Digest hoạt động theo kiểu thử thách và phản hồi (**challenge-response**): server gửi một `nonce`, client băm mật khẩu cùng nonce đó rồi gửi lại. Công cụ như `svcrack` của SIPVicious tự động thử hàng nghìn mật khẩu.

Đây là nơi các thói quen tệ trả giá. Rất nhiều triển khai đặt mật khẩu extension trùng số extension (`1001`/`1001`), hoặc dùng những chuỗi như `1234`, `secret`, tên công ty. Với mật khẩu yếu, brute-force thành công chỉ trong ít phút.

## Bước 4: Bơm cuộc gọi

Khi đã có một extension hợp lệ với mật khẩu đúng, kẻ tấn công đăng ký như một máy nhánh thật và bắt đầu gửi `INVITE` tới các đầu số premium quốc tế. Nếu **dialplan** cho phép extension đó gọi ra ngoài không giới hạn, cuộc gọi đi qua trung kế (**trunk**) và đồng hồ cước bắt đầu chạy. Họ thường mở nhiều kênh song song để nhồi càng nhiều phút càng tốt trước khi bị phát hiện.

Toàn bộ chuỗi này, từ quét tới cuộc gọi đầu tiên, hoàn toàn tự động hoá và có thể hoàn tất trong vài chục phút nếu tổng đài mở và mật khẩu yếu.

# Vì sao DMZ cộng auth chặn được

Bây giờ tới phần thú vị: hai biện pháp cơ bản, và lý do chúng hiệu quả không phải vì thần kỳ mà vì chúng cắt đúng vào các giả định của kẻ tấn công.

## DMZ: giới hạn ai được phép gõ cửa

**DMZ (demilitarized zone)** là một phân đoạn mạng nằm giữa Internet và mạng nội bộ, tách bởi firewall. Ý tưởng gốc của DMZ không phải giấu tổng đài đi, mà là kiểm soát chặt luồng vào ra của nó và cô lập nó khỏi phần còn lại của hệ thống nếu nó bị chiếm.

Với một tổng đài, tư duy DMZ thực dụng là: SIP không nên là dịch vụ mở cho cả hành tinh. Trong đa số môi trường doanh nghiệp, ta biết trước ai cần kết nối tới nó:

- Trung kế SIP chỉ đến từ dải IP của nhà cung cấp dịch vụ thoại (**ITSP**). Dải này cố định và ít.
- Điện thoại nội bộ nằm trong LAN, không cần đi qua IP public.
- Nhân viên làm việc từ xa nên vào qua **VPN**, chứ không phải phơi SIP thẳng ra ngoài.

Firewall của DMZ vì thế chỉ cần cho phép cổng SIP và dải RTP từ đúng các nguồn đã biết, chặn phần còn lại theo mặc định (**default deny**). Điều này vô hiệu hoá gần như toàn bộ Bước 1 và Bước 2. Máy quét ở một IP ngẫu nhiên trên Internet không còn gửi được gói tin nào tới tổng đài, nên không thể điểm danh máy chủ, không thể điểm danh extension, không có gì để brute-force. Kẻ tấn công không phá được một cánh cửa mà nó không chạm tới được.

Một hệ quả kiến trúc quan trọng: nếu bắt buộc phải mở SIP ra ngoài (ví dụ có softphone di động), đặt trước nó một **SBC (Session Border Controller)** hoặc một SIP proxy làm lớp chắn, thay vì để Asterisk trực tiếp đối mặt Internet. SBC được thiết kế đúng cho việc chịu đòn ở biên: rate limiting, lọc theo địa lý, phát hiện quét.

## Auth: biến việc đoán thành bất khả thi kinh tế

Firewall cắt được kẻ lạ, nhưng không cắt được kẻ tấn công đến từ một nguồn hợp lệ, hay trường hợp buộc phải mở dịch vụ. Đây là lúc xác thực gánh phần còn lại. Ba nguyên tắc:

1. **Mật khẩu mạnh và ngẫu nhiên cho mọi extension.** Một chuỗi ngẫu nhiên đủ dài biến không gian brute-force thành thiên văn. Khi mỗi lần thử tốn thời gian mạng, đoán một mật khẩu 16 ký tự ngẫu nhiên là bất khả thi về mặt thực tế. Điều này giết Bước 3.
2. **Chống điểm danh extension.** Trong Asterisk, tham số `alwaysauthreject=yes` (với `chan_sip`) hoặc hành vi tương đương trong `res_pjsip` bắt tổng đài phản hồi giống hệt nhau cho extension sai và mật khẩu sai. Kẻ tấn công không còn phân biệt được 401 với 404, nên không dựng được danh sách extension. Điều này bịt lỗ rò ở Bước 2.
3. **Khoá theo tần suất thất bại.** Kết hợp Asterisk với **fail2ban**: đọc log, thấy một IP liên tục xác thực hỏng thì tự thêm luật firewall chặn IP đó. Đây là lưới an toàn cho cả những nỗ lực brute-force lọt qua.

Ngoài xác thực, còn một lớp phòng thủ mà mình xem là bắt buộc chứ không phải tuỳ chọn: **giới hạn dialplan**. Ngay cả khi một extension bị chiếm, nếu dialplan của nó không được phép gọi quốc tế thì cuộc gọi cước lậu không đi ra được. Nguyên tắc đặc quyền tối thiểu áp vào thoại: một máy nhánh lễ tân chỉ cần gọi nội bộ và nội hạt thì đừng cho nó gọi tới đầu số vệ tinh ở nửa kia địa cầu. Thêm trần chi tiêu hoặc cảnh báo khi lưu lượng quốc tế vọt bất thường, và ngay cả khi mọi lớp trên thủng, thiệt hại vẫn bị chặn trần.

# Một cấu hình phòng thủ tối thiểu

Gộp lại, một tổng đài Asterisk chịu được các đợt quét thường trực có những đặc điểm sau:

```
; res_pjsip / chan_sip: không tiết lộ extension nào tồn tại
alwaysauthreject = yes

; bắt buộc xác thực cho mọi cuộc gọi vào
allowguest = no

; mật khẩu extension: chuỗi ngẫu nhiên dài, không trùng số máy
; ví dụ secret = 9fK2$pQ7wL!x4Rt8

; dialplan: chỉ mở quốc tế cho những extension thật sự cần
```

Kèm theo đó là firewall default-deny chỉ mở SIP/RTP cho dải ITSP và VPN, fail2ban đọc log Asterisk, và giám sát cước để bắt bất thường sớm. Không có món nào trong đây là công nghệ mới. Tất cả đều đã có từ hơn một thập kỷ. Điều đáng nói là phần lớn các vụ cước lậu vẫn xảy ra vì thiếu đúng những thứ nhàm chán này: một tổng đài dựng nhanh cho kịp việc, IP public, mật khẩu mặc định, và không ai nhìn lại.

# Kết

Điều mình thấy đáng suy nghĩ nhất về toll fraud là nó gần như không dùng lỗ hổng phần mềm nào. Không có CVE nào cần vá, không có exploit tinh vi. Nó chỉ khai thác một chuỗi các mặc định hợp lý cho môi trường tin cậy nhưng nguy hiểm khi phơi ra môi trường thù địch: SIP mở, phản hồi khác nhau cho extension tồn tại, mật khẩu dễ đoán, dialplan rộng rãi. Firewall và xác thực chặn được nó không phải vì chúng thông minh, mà vì chúng lập lại đúng các ranh giới tin cậy mà kiến trúc mặc định đã xoá đi.

Có lẽ đó là bài học chung của nhiều thứ trong bảo mật: phần lớn phòng thủ hiệu quả không nằm ở công cụ mới, mà ở việc thành thật trả lời câu hỏi ai thật sự cần chạm vào cái này, rồi mạnh dạn chặn tất cả những gì còn lại. Với thoại, câu hỏi đó có một sức nặng cụ thể: mỗi phút bỏ lửng là tiền thật.

# Tài liệu tham khảo

- RFC 3261, *SIP: Session Initiation Protocol*, IETF.
- RFC 3550, *RTP: A Transport Protocol for Real-Time Applications*, IETF.
- Asterisk Documentation, *Security* và *PJSIP Configuration*, Sangoma (docs.asterisk.org).
- SIPVicious, bộ công cụ kiểm thử SIP của Sandro Gauci (github.com/EnableSecurity/sipvicious).
- Communications Fraud Control Association (CFCA), báo cáo thường niên về International Revenue Share Fraud.
- fail2ban, tài liệu chính thức (www.fail2ban.org).

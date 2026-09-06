---
title: Bảo mật một stack VoIP đầu-cuối
excerpt: "TLS, SRTP, Fail2Ban và firewall cùng chạy trên một FreePBX: cách khoá một tổng đài mềm khỏi Internet."
permalink: /topics/bao-mat-mot-stack-voip-dau-cuoi/
categories:
  - topics
  - security
date: 2025-12-30 09:00
---


Về lý thuyết, một cuộc gọi **VoIP** (Voice over IP) chỉ là những gói dữ liệu chạy qua mạng IP giống hệt email hay một request HTTP. Điều đó nghe rất bình thường, nhưng nó kéo theo một hệ quả mà nhiều người dựng tổng đài lần đầu hay quên: nếu một tổng đài mềm như **FreePBX** phơi mặt ra Internet mà không được rào chắn, thì bất kỳ ai trên thế giới cũng có thể gõ cửa nó, dò mật khẩu, và trong trường hợp xấu nhất là quay số quốc tế bằng tiền của chúng ta. Bài này mình muốn đi qua cách khoá một stack VoIP theo kiểu đầu-cuối, ngay trên chính con máy chạy tổng đài, bằng ba lớp bổ trợ nhau: mã hoá **(TLS/SRTP)**, chặn dò mật khẩu **(Fail2Ban)**, và một **firewall** biết chuyện.

## VoIP thực ra gồm những gì?

Điều làm VoIP hơi khác các dịch vụ web thông thường là nó tách làm hai luồng riêng biệt.

Luồng thứ nhất là **báo hiệu (signaling)**: ai gọi ai, đổ chuông, nhấc máy, cúp máy. Giao thức phổ biến nhất ở đây là **SIP** (Session Initiation Protocol), định nghĩa trong **RFC 3261**. SIP là text, đọc gần giống HTTP, chạy mặc định trên cổng **5060** (UDP hoặc TCP).

Luồng thứ hai là **thoại (media)**: chính giọng nói được số hoá, đóng thành gói và gửi đi bằng **RTP** (Real-time Transport Protocol, **RFC 3550**). RTP thường chạy trên một dải cổng UDP cao, ví dụ **10000 đến 20000**.

Điểm mấu chốt về bảo mật nằm ở đây: mặc định, cả SIP lẫn RTP đều là plaintext. Một người ngồi giữa đường truyền có thể đọc được số máy, thậm chí dùng công cụ như `wireshark` để ghép các gói RTP lại thành file `.wav` và nghe lại nguyên cuộc gọi. Mã hoá không phải thứ trang trí ở đây, nó là điều kiện cần.

## Lịch sử một chút

VoIP không mới. Ý tưởng truyền thoại qua mạng dữ liệu đã có từ những năm 1990, và **SIP** được IETF chuẩn hoá lần đầu năm 1999, rồi cập nhật thành **RFC 3261** năm 2002. **Asterisk**, phần lõi mã nguồn mở mà FreePBX bọc bên ngoài, xuất hiện năm 1999 do Mark Spencer viết. Trong một thời gian dài, các tổng đài này sống trong mạng nội bộ doanh nghiệp, sau một router NAT, nên chuyện bảo mật ít ai để tâm.

Vấn đề bắt đầu khi người ta kéo tổng đài lên VPS để nhân viên làm việc từ xa cắm softphone vào. Lúc đó cổng 5060 mở toang ra Internet, và các bot quét SIP xuất hiện gần như tức thì. Đây không phải chuyện lý thuyết: một con VPS mới dựng, mở 5060, thường nhận request `REGISTER` dò tài khoản trong vòng vài giờ. Mục tiêu của kẻ tấn công đơn giản là chiếm một extension để quay số ra các đầu số quốc tế tính cước cao, một dạng gian lận gọi là **toll fraud**.

## Lớp 1: Mã hoá đường truyền với TLS và SRTP

Nếu tách hai luồng của VoIP, ta cũng có hai cơ chế mã hoá tương ứng.

**SIP over TLS** bảo vệ luồng báo hiệu. Thay vì SIP chạy trần trên UDP 5060, ta cho nó chạy trong một phiên **TLS** giống HTTPS, thường trên cổng **5061/TCP**. Như vậy metadata cuộc gọi (số gọi đi, số gọi đến, thông tin xác thực) không còn đọc được trên đường truyền.

**SRTP** (Secure RTP, **RFC 3711**) bảo vệ luồng thoại. Nó mã hoá payload của từng gói RTP, thường bằng **AES**, nên dù ai đó bắt được gói thì cũng không dựng lại được giọng nói. Khoá phiên cho SRTP thường được trao đổi ngay trong phần thân SDP của SIP, nên đây là lý do TLS và SRTP hay đi cùng nhau: nếu SIP còn plaintext thì khoá SRTP đi kèm cũng lộ, và mã hoá thoại trở nên vô nghĩa.

Trên FreePBX, việc bật hai thứ này gồm mấy bước. Trước hết cần một chứng chỉ TLS, có thể tự ký hoặc lấy từ **Let's Encrypt** qua module Certificate Management. Sau đó, trong cấu hình SIP (với chip **PJSIP** hiện đại) ta cho phép transport TLS và bật SRTP ở mức extension. Trong `pjsip.transports.conf` phần khai báo transport TLS trông đại khái như sau:

```ini
[transport-tls]
type=transport
protocol=tls
bind=0.0.0.0:5061
cert_file=/etc/asterisk/keys/fullchain.pem
priv_key_file=/etc/asterisk/keys/privkey.pem
method=tlsv1_2
```

Rồi ở mỗi extension, đặt `media_encryption=srtp`, và `transport=transport-tls`. Một lưu ý thực tế: softphone hai đầu phải cùng nói được TLS/SRTP, nếu không cuộc gọi sẽ đổ chuông nhưng không có tiếng, hoặc từ chối kết nối. Đây là chỗ dễ mất thời gian debug nhất.

Cũng cần thành thật một điều: TLS/SRTP bảo vệ chặng từ softphone tới tổng đài của chúng ta. Khi cuộc gọi rời tổng đài đi ra **PSTN** (mạng điện thoại truyền thống) qua nhà cung cấp **SIP trunk**, phần mã hoá phụ thuộc vào nhà cung cấp đó, nằm ngoài tầm kiểm soát. "Đầu-cuối" ở đây nên hiểu là đầu-cuối trong phạm vi hệ thống mình quản lý, không phải một lời hứa mã hoá tuyệt đối tới tận người nghe bên kia.

## Lớp 2: Chặn dò mật khẩu với Fail2Ban

Mã hoá không ngăn được việc ai đó ngồi thử mật khẩu. Với những bot quét SIP nói ở trên, thứ ta cần là một cơ chế phát hiện và chặn động. Đó là **Fail2Ban**.

Nguyên lý của Fail2Ban rất đơn giản và cũng rất đẹp: nó đọc log của dịch vụ, dùng biểu thức chính quy để bắt các dòng "đăng nhập thất bại", đếm số lần từ một địa chỉ IP, và khi vượt ngưỡng thì gọi firewall chèn một luật chặn IP đó trong một khoảng thời gian. Asterisk có sẵn một logger tên là `security` ghi ra các sự kiện xác thực, rất hợp để Fail2Ban đọc.

Một cấu hình jail điển hình cho Asterisk trong `jail.local`:

```ini
[asterisk]
enabled  = true
port     = 5060,5061
filter   = asterisk
logpath  = /var/log/asterisk/security.log
maxretry = 5
findtime = 600
bantime  = 3600
```

Đọc ra tiếng người: nếu một IP gây quá **5** lần thất bại trong **600** giây, chặn nó **3600** giây. Nhiều người còn đặt `bantime` rất dài, thậm chí vĩnh viễn cho các IP tái phạm, vì một địa chỉ đã dò SIP thì hiếm khi là bạn tốt.

Fail2Ban không phải viên đạn bạc. Nó phản ứng, tức là kẻ tấn công vẫn thử được vài lần trước khi bị chặn. Nó cũng chỉ tốt bằng regex trong file filter: nếu định dạng log thay đổi sau một lần nâng cấp Asterisk, filter có thể lặng lẽ ngừng khớp, và ta cứ tưởng mình được bảo vệ. Vì thế nên thỉnh thoảng kiểm tra `fail2ban-client status asterisk` để chắc rằng nó thực sự đang bắt và chặn.

## Lớp 3: Firewall, lớp rào cứng nhất

Fail2Ban là hàng rào phản ứng. Firewall là hàng rào tĩnh, và nếu cấu hình đúng thì nó là lớp mạnh nhất vì nó chặn trước cả khi gói tin chạm tới Asterisk.

Triết lý ở đây là **default deny**: chặn tất cả, chỉ mở đúng thứ cần. Trên một FreePBX, danh sách "thứ cần mở" thường ngắn đến bất ngờ:

1. **Cổng quản trị web** (thường 443, và 80 cho việc gia hạn Let's Encrypt), chỉ mở cho IP quản trị của mình.
2. **SIP** (5060/5061) và dải **RTP** (ví dụ 10000-20000/UDP), chỉ mở cho các IP thực sự cần cắm máy vào, ví dụ IP tĩnh của văn phòng hoặc dải của nhà cung cấp SIP trunk.
3. **SSH** (22), cũng chỉ mở cho IP quản trị.

Điểm mấu chốt, và cũng là điều nhiều người bỏ lỡ: nếu nhân viên có IP cố định hoặc dùng VPN, thì không có lý do gì để mở 5060 ra cả `0.0.0.0/0`. Một cách làm gọn hơn nữa là dựng một **VPN** (WireGuard chẳng hạn), cho toàn bộ softphone quay vào VPN, rồi firewall chỉ mở cổng SIP cho dải VPN nội bộ. Khi đó tổng đài gần như tàng hình trước Internet.

FreePBX có một module Firewall khá tốt bọc quanh `firewalld`, phân IP thành các "zone" như Trusted, Local, Internet, và tự động bung dải RTP theo cấu hình. Nếu thích tự làm ở lớp dưới, một luật `iptables` tối giản để chỉ cho một IP tin cậy chạm vào SIP trông như sau:

```bash
# Cho phép IP văn phòng tin cậy
iptables -A INPUT -p udp --dport 5060 -s 203.0.113.10 -j ACCEPT
# Mọi nguồn khác tới 5060 thì bỏ
iptables -A INPUT -p udp --dport 5060 -j DROP
```

Một chi tiết dân mạng hay vấp: firewall phải hiểu rằng RTP là **stateful theo kiểu lỏng**, tức là dải cổng động được thương lượng qua SIP. Nếu chặn nhầm dải RTP, cuộc gọi sẽ kết nối được nhưng một chiều hoặc không có tiếng, đúng cái triệu chứng dễ nhầm với lỗi TLS ở trên. Khi debug "gọi được mà không nghe thấy gì", hãy nghĩ tới cả firewall RTP lẫn mã hoá media, chứ đừng vội đổ cho một phía.

## Ba lớp ghép lại

Điều mình thích ở stack này là cách ba lớp bù trừ cho nhau thay vì trùng lặp. Firewall giảm bề mặt tấn công xuống gần bằng không, chỉ còn những IP mình chủ động cho vào. Với số ít traffic lọt qua được firewall, Fail2Ban theo dõi hành vi và chặn động những kẻ cố dò mật khẩu. Và TLS/SRTP đảm bảo rằng ngay cả khi ai đó ngồi trên đường truyền, họ cũng không đọc được nội dung. Đây chính là **defense in depth** ở quy mô một con máy: không lớp nào hoàn hảo, nhưng để xuyên qua cả ba thì khó hơn nhiều bậc.

Ngoài ba lớp chính, có vài thói quen nhỏ đáng giữ: đặt giới hạn quay số quốc tế (outbound route restrictions) để kể cả khi một extension bị chiếm thì thiệt hại cũng có trần; đặt mật khẩu SIP secret dài và ngẫu nhiên thay vì trùng với số extension; và cập nhật FreePBX/Asterisk đều đặn, vì phần lớn các vụ toll fraud lớn đều khai thác một tài khoản yếu hoặc một cổng mở, chứ hiếm khi là một lỗ hổng zero-day tinh vi.

Có một câu hỏi mình vẫn thấy chưa có đáp án gọn: nên rào tổng đài chặt tới đâu là đủ? Rào quá lỏng thì thành mồi cho bot. Rào quá chặt, chẳng hạn ép mọi thứ qua VPN, thì lại phiền cho người dùng di động hay đổi mạng liên tục, và cái phiền đó đôi khi đẩy người ta tự mở cổng ra cho tiện, phá hỏng chính lớp bảo vệ. Bảo mật VoIP, ở khía cạnh này, không hẳn là bài toán kỹ thuật thuần tuý mà là một sự cân bằng giữa an toàn và trải nghiệm, và ranh giới đó mỗi hệ thống lại đặt ở một chỗ khác nhau.

## Tài liệu tham khảo

- RFC 3261, SIP: Session Initiation Protocol (IETF)
- RFC 3550, RTP: A Transport Protocol for Real-Time Applications (IETF)
- RFC 3711, The Secure Real-time Transport Protocol (SRTP) (IETF)
- Tài liệu chính thức Asterisk: PJSIP và cấu hình TLS/SRTP (wiki.asterisk.org)
- Tài liệu FreePBX: System Admin, Firewall và Certificate Management (sangoma.com)
- Tài liệu Fail2Ban (fail2ban.org)

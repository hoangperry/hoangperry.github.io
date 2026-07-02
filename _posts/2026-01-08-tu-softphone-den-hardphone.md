---
title: Từ softphone đến hardphone
excerpt: "Cấu hình endpoint SIP trên Asterisk, và câu chuyện đánh đổi codec giữa băng thông với chất lượng thoại."
permalink: /topics/tu-softphone-den-hardphone/
categories:
  - topics
  - electronics
date: 2026-01-08 09:00
---


# VoIP là gì?

Về lý thuyết, **VoIP** (Voice over IP) là kỹ thuật truyền giọng nói qua mạng dữ liệu gói thay vì qua mạng chuyển mạch kênh của điện thoại truyền thống. Thay vì dành riêng một đường mạch đồng cho mỗi cuộc gọi như tổng đài analog cũ, chúng ta số hoá âm thanh, cắt nhỏ thành các **packet**, rồi gửi chúng đi qua cùng một hạ tầng IP mà chúng ta vẫn dùng để lướt web.

Để hai đầu máy nói chuyện được với nhau, chúng ta cần hai thứ tách bạch: một giao thức để **dựng và phá cuộc gọi** (signaling), và một cách để **mang dữ liệu âm thanh** thực sự (media). Trong thế giới mở, signaling gần như luôn là **SIP** (Session Initiation Protocol), còn media là **RTP** (Real-time Transport Protocol). SIP giống như cuộc trao đổi lúc bắt máy: ai gọi ai, dùng codec nào, gửi RTP về địa chỉ IP và cổng nào. Sau khi hai bên bắt tay xong, giọng nói không đi qua SIP nữa mà chảy thẳng qua RTP.

Một chi tiết hay bị nhầm: **Asterisk**, tổng đài phần mềm phổ biến nhất, không nhất thiết phải nằm giữa dòng RTP. Nó là **Back-to-Back User Agent (B2BUA)**, nghĩa là nó có thể tự tay xử lý và chuyển mã (transcode) media, hoặc chỉ dựng cuộc gọi rồi để hai endpoint tự bắn RTP trực tiếp cho nhau. Cách sau nhẹ CPU hơn nhiều, nhưng hay vỡ khi có **NAT** chen vào, và mình sẽ nói kỹ ở dưới.

# Softphone và hardphone

Cái tên bài viết này nói về hai hình hài của cùng một **endpoint SIP**.

Một **softphone** là phần mềm chạy trên máy tính hoặc điện thoại: Zoiper, Linphone, MicroSIP, hay client trong một app doanh nghiệp. Nó dùng loa và micro sẵn có của thiết bị, đăng ký (register) lên tổng đài y hệt như một máy bàn thật. Softphone tiện để thử nghiệm vì chúng ta không phải mua phần cứng, chỉ cần một tài khoản SIP là gọi được ngay.

Một **hardphone** là chiếc máy bàn IP thật, ví dụ dòng Grandstream, Yealink hay Cisco. Về bản chất giao thức nó không khác softphone: cũng REGISTER, cũng INVITE, cũng RTP. Khác biệt nằm ở trải nghiệm và độ ổn định. Hardphone có bộ codec âm thanh riêng, có **echo cancellation** phần cứng, có nút bấm vật lý, và quan trọng là nó không tranh giành CPU với trình duyệt hay cuộc họp video đang mở. Với một quầy lễ tân gọi cả ngày, cái máy bàn vẫn thắng.

Điều mình muốn nhấn mạnh: đứng từ phía Asterisk, cả hai chỉ là một dòng cấu hình endpoint. Chúng ta không cần biết đầu bên kia là app hay là cục nhựa có nút bấm. Đó chính là vẻ đẹp của việc chuẩn hoá quanh SIP.

# Cấu hình endpoint với PJSIP

Asterisk hiện đại dùng stack **PJSIP** thay cho `chan_sip` đời cũ (`chan_sip` đã bị gỡ khỏi Asterisk 21). Cấu hình nằm trong `pjsip.conf`, và điểm khó chịu lúc mới học là một endpoint bị tách thành nhiều mục (section) riêng: phần định danh, phần xác thực, và phần địa chỉ liên lạc. Tách như vậy nghe rườm rà, nhưng nó cho phép một endpoint có nhiều cách xác thực hoặc nhiều thiết bị cùng đăng ký.

Một endpoint tối thiểu cho máy nhánh số **6001** trông như sau:

```ini
[6001]
type = endpoint
context = internal
disallow = all
allow = opus
allow = ulaw
auth = 6001-auth
aors = 6001

[6001-auth]
type = auth
auth_type = userpass
username = 6001
password = mot-mat-khau-that-manh

[6001]
type = aor
max_contacts = 1
```

Diễn giải nhanh các mảnh:

1. `type = endpoint` là danh tính logic của máy nhánh, nơi khai báo codec và **dialplan context** mà cuộc gọi từ máy này sẽ rơi vào.
2. `type = auth` giữ thông tin đăng nhập. Tách riêng để chúng ta có thể xoay mật khẩu mà không đụng phần còn lại.
3. `type = aor` (Address of Record) là nơi Asterisk ghi nhớ endpoint hiện đang ở địa chỉ IP nào sau khi nó REGISTER. `max_contacts = 1` nghĩa là chỉ cho phép một thiết bị đăng ký cùng lúc dưới số này.

Thứ tự trong `disallow` và `allow` không phải trang trí. Asterisk đọc từ trên xuống và danh sách này chính là **thứ tự ưu tiên codec** mà nó chào ra trong phiên SIP. Ở đây mình đặt `opus` trước `ulaw`: nếu đầu kia hiểu Opus thì hai bên dùng Opus, còn không thì lùi về `ulaw`. Chúng ta luôn nên để một codec nền phổ quát như `ulaw` ở cuối để không bao giờ rơi vào cảnh không có codec chung.

Sau khi sửa file, nạp lại mà không cần khởi động lại toàn bộ:

```bash
asterisk -rx "pjsip reload"
asterisk -rx "pjsip show endpoint 6001"
```

# Đánh đổi codec

Đây là phần thú vị nhất, và cũng là chỗ nhiều người cấu hình theo cảm tính. **Codec** thoại quyết định chúng ta số hoá giọng nói như thế nào, và mỗi lựa chọn là một sự đánh đổi giữa băng thông, chất lượng, độ trễ, và tải CPU.

## G.711 (ulaw / alaw)

**G.711** là codec lâu đời, mã hoá âm thanh 8 kHz bằng cách lấy mẫu tuyến tính rồi nén logarit thành 8 bit mỗi mẫu. Nó gần như không nén: dòng payload âm thanh khoảng **64 kbit/s** một chiều. Bù lại, nó gần như không tốn CPU để mã hoá và cho chất lượng thoại "chuẩn điện thoại bàn" rất ổn định. `ulaw` là biến thể dùng ở Bắc Mỹ và Nhật, `alaw` dùng ở châu Âu và phần lớn phần còn lại của thế giới. Trên LAN nội bộ hoặc đường truyền rộng rãi, G.711 là lựa chọn an toàn và mình hầu như luôn để nó làm codec dự phòng cuối.

## G.729

**G.729** nén mạnh hơn nhiều, xuống còn khoảng **8 kbit/s**, nên rất được ưa chuộng thời băng thông đắt đỏ. Cái giá phải trả là thuật toán nén phức tạp hơn (tốn CPU khi transcode nhiều kênh) và chất lượng thoại kém hơn G.711 một chút, đặc biệt khi âm thanh đi qua nhiều lần chuyển mã liên tiếp (tandem encoding). Ngày nay khi băng thông đã rẻ, lý do dùng G.729 chủ yếu là để tương thích với các thiết bị hoặc nhà mạng cũ.

## Opus

**Opus** là codec hiện đại, mở, và rất linh hoạt. Nó có thể co giãn bitrate động, hỗ trợ **wideband** (16 kHz) và cả **fullband**, nghĩa là giọng nói nghe đầy đặn và tự nhiên hơn hẳn so với dải hẹp 8 kHz của G.711 hay G.729. Với softphone và hầu hết hardphone đời mới, Opus là lựa chọn cho chất lượng tốt nhất trên mỗi bit băng thông. Nhược điểm là không phải thiết bị cũ nào cũng hiểu Opus, và transcode Opus tốn CPU đáng kể nếu tổng đài phải làm việc đó cho nhiều kênh đồng thời.

Một bảng so sánh thô để dễ hình dung:

| Codec | Bitrate payload xấp xỉ | Dải tần | CPU transcode | Ghi chú |
|-------|------------------------|---------|---------------|---------|
| G.711 (ulaw/alaw) | ~64 kbit/s | Hẹp (8 kHz) | Rất thấp | Nền phổ quát, luôn nên giữ |
| G.729 | ~8 kbit/s | Hẹp (8 kHz) | Trung bình | Tiết kiệm băng thông, chất lượng vừa |
| Opus | ~6 tới 64 kbit/s (động) | Rộng, đầy | Cao | Chất lượng tốt nhất khi hai đầu đều hỗ trợ |

Lưu ý con số bitrate ở trên chỉ là phần **payload âm thanh**. Trên thực tế, mỗi packet RTP còn gánh thêm header của RTP, UDP, và IP. Với gói âm thanh nhỏ gửi mỗi 20 ms, phần header này chiếm tỉ lệ đáng kể, nên băng thông thực tế trên đường truyền luôn cao hơn con số payload, đôi khi cao hơn khá nhiều với các codec nén mạnh như G.729.

## Nguyên tắc mình hay theo

Về đánh đổi, triết lý của mình đơn giản: **để chất lượng cao nhất lên đầu, để codec phổ quát ở cuối, và tránh transcode bất cứ khi nào có thể.** Nếu cả hai endpoint cùng chào Opus, Asterisk sẽ để chúng nói Opus với nhau và không phải chuyển mã, vừa nhẹ CPU vừa cho chất lượng tốt. Transcode chỉ nên xảy ra khi bắt buộc, ví dụ một đầu là hardphone cũ chỉ biết `alaw` còn đầu kia là softphone Opus. Mỗi lần transcode là một lần Asterisk phải giải mã rồi mã hoá lại, tốn CPU và cộng thêm một chút độ trễ.

# NAT, cái bẫy kinh điển

Không bài viết nào về endpoint SIP nên bỏ qua **NAT**, vì đây là nơi phần lớn cuộc gọi "đổ chuông được nhưng không nghe thấy gì" đến từ. Vấn đề gốc rễ: SIP và RTP mang địa chỉ IP ngay trong nội dung thông điệp. Khi một endpoint sau router NAT khai báo "hãy gửi RTP về IP 192.168.1.20 của tôi", cái IP nội bộ đó vô nghĩa với tổng đài ở ngoài internet. Kết quả là signaling xong xuôi, chuông reo, nhưng âm thanh đi lạc vào hư không, dẫn tới hiện tượng **one-way audio** hoặc mất tiếng hoàn toàn.

Trong PJSIP, vài tham số cấu hình endpoint giúp xử lý chuyện này:

```ini
[6001]
type = endpoint
context = internal
disallow = all
allow = opus
allow = ulaw
auth = 6001-auth
aors = 6001
rtp_symmetric = yes
force_rport = yes
rewrite_contact = yes
direct_media = no
```

- `rtp_symmetric = yes` bảo Asterisk gửi RTP trở lại đúng địa chỉ và cổng mà nó thực sự **nhận được** gói từ endpoint, thay vì tin vào IP mà endpoint tự khai. Đây thường là mấu chốt gỡ one-way audio.
- `force_rport = yes` và `rewrite_contact = yes` làm điều tương tự cho phía signaling: dùng địa chỉ nguồn thật của gói SIP thay vì địa chỉ ghi trong header.
- `direct_media = no` buộc media đi vòng qua Asterisk thay vì để hai endpoint bắn RTP thẳng cho nhau. Trên môi trường có NAT, để tổng đài làm trung gian thường ổn định hơn, dù phải trả giá bằng băng thông và một chút tải trên máy chủ.

Với thiết lập ở nhà hay văn phòng nhỏ, mình gần như luôn bật cả ba tham số NAT đầu và để `direct_media = no`. Chúng ta hy sinh một chút hiệu năng để đổi lấy cuộc gọi nghe được ở cả hai chiều, và đó là đánh đổi đáng giá.

# Kết

Đi từ softphone tới hardphone, chúng ta thấy một điều dễ chịu: bên dưới lớp vỏ khác nhau, tất cả đều quy về cùng một endpoint SIP mà Asterisk đối xử như nhau. Cấu hình không khó, phần khó nằm ở những đánh đổi: codec nào cho chất lượng, codec nào cho băng thông, khi nào chấp nhận transcode, và làm sao để NAT không nuốt mất giọng nói.

Mình không nghĩ có một cấu hình "đúng" cho mọi trường hợp. Một tổng đài nội bộ toàn máy bàn trên LAN sẽ tối ưu khác hẳn một hệ thống có nhân viên gọi từ nhà qua đủ loại đường mạng. Cái hay của việc hiểu từng tham số là chúng ta có thể tự tin xoay các núm này theo hoàn cảnh, thay vì sao chép một khối cấu hình từ đâu đó rồi cầu cho nó chạy. Và nếu một ngày bạn nhấc máy lên, nghe thấy tiếng chuông nhưng đầu kia im lặng, thì rất có thể thủ phạm chỉ là một dòng `rtp_symmetric` còn thiếu.

# Tài liệu tham khảo

- Asterisk Documentation, "Configuring res_pjsip" (docs.asterisk.org)
- RFC 3261, "SIP: Session Initiation Protocol"
- RFC 3550, "RTP: A Transport Protocol for Real-Time Applications"
- ITU-T Recommendation G.711 và G.729
- RFC 6716, "Definition of the Opus Audio Codec"
- Van Meggelen, Madsen, Smith, "Asterisk: The Definitive Guide" (O'Reilly)

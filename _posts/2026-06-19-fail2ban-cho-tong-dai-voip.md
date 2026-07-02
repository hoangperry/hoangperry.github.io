---
title: Fail2Ban cho tổng đài VoIP
excerpt: "Chặn brute-force SIP bằng jail Fail2Ban: đọc log tấn công thật và diễn giải từng dòng."
permalink: /topics/fail2ban-cho-tong-dai-voip/
categories:
  - topics
  - security
date: 2026-06-19 09:00
---

Nếu chúng ta từng mở một tổng đài **VoIP** ra Internet công cộng, dù chỉ vài giờ, gần như chắc chắn trong log đã có người gõ cửa. Không phải một người, mà là hàng loạt con bot quét cả dải IPv4 để tìm cổng **SIP** 5060 đang mở. Bài này mình muốn đi qua cách dùng **Fail2Ban** để chặn kiểu tấn công brute-force đó, và quan trọng hơn là ngồi đọc lại log tấn công thật để hiểu chúng ta đang chống lại cái gì.

# SIP và bề mặt tấn công là gì?

Về lý thuyết, **SIP** (*Session Initiation Protocol*, mô tả trong **RFC 3261**) là giao thức báo hiệu: nó không mang giọng nói, nó chỉ lo việc thiết lập, sửa đổi và kết thúc một cuộc gọi. Âm thanh thật đi qua **RTP** trên các cổng khác. SIP là giao thức dạng text, các bản tin trông rất giống HTTP, với những phương thức như `REGISTER`, `INVITE`, `OPTIONS`, `SUBSCRIBE`.

Điểm yếu nằm ở chỗ này. Để một máy điện thoại đăng ký vào tổng đài, nó gửi một bản tin `REGISTER` kèm thông tin xác thực. Tổng đài trả về `401 Unauthorized` cùng một **nonce**, máy điện thoại băm mật khẩu theo cơ chế **digest authentication** rồi gửi lại. Nếu sai, tổng đài lại trả `401` hoặc `403 Forbidden`. Cả một vòng lặp hỏi-đáp, và mỗi lần sai đều để lại một dòng trong log. Kẻ tấn công chỉ việc thử `REGISTER` liên tục với hàng nghìn số máy nhánh (extension) và mật khẩu phổ biến. Đây chính là **brute-force SIP**.

Một biến thể tinh vi hơn dùng `OPTIONS` hoặc `INVITE` để dò xem extension nào tồn tại trước, dựa vào việc tổng đài trả về mã lỗi khác nhau cho số có thật và số không có thật. Đó là **extension enumeration**, bước do thám trước khi dồn sức đoán mật khẩu.

# Fail2Ban hoạt động thế nào?

**Fail2Ban** là một daemon viết bằng Python. Ý tưởng của nó đơn giản đến mức đẹp: đọc log của một dịch vụ, so từng dòng với một tập biểu thức chính quy (**regex**), và khi một địa chỉ IP vi phạm quá nhiều lần trong một khoảng thời gian, nó gọi firewall của hệ điều hành để chặn IP đó lại trong một khoảng thời gian nhất định.

Ba khái niệm cốt lõi:

1. **Filter**: tập regex mô tả một dòng log "xấu". Fail2Ban cần trích ra được địa chỉ IP thủ phạm qua một nhóm bắt tên là `<HOST>`.
2. **Jail**: bản cấu hình gắn một filter vào một file log cụ thể, kèm ngưỡng `maxretry`, cửa sổ thời gian `findtime`, và thời gian chặn `bantime`.
3. **Action**: việc cần làm khi ban, thường là thêm một luật vào **iptables**, **nftables** hoặc **firewalld**.

Công thức tinh thần rất gọn: nếu một IP tạo ra nhiều hơn **maxretry** dòng log khớp filter trong vòng **findtime** giây, chặn nó trong **bantime** giây.

# Đọc log tấn công thật

Đây là phần mình thấy thú vị nhất. Dưới đây là một đoạn log **Asterisk** đã được rút gọn và thay IP, nhưng cấu trúc thì đúng như những gì chúng ta gặp ngoài đời:

```text
[2026-06-15 02:11:07] NOTICE[2043] chan_sip.c: Registration from '"100" <sip:100@vd.example.net>' failed for '203.0.113.44:5081' - Wrong password
[2026-06-15 02:11:07] NOTICE[2043] chan_sip.c: Registration from '"101" <sip:101@vd.example.net>' failed for '203.0.113.44:5081' - Wrong password
[2026-06-15 02:11:08] NOTICE[2043] chan_sip.c: Registration from '"102" <sip:102@vd.example.net>' failed for '203.0.113.44:5081' - No matching peer found
[2026-06-15 02:11:08] NOTICE[2043] chan_sip.c: Registration from '"admin" <sip:admin@vd.example.net>' failed for '203.0.113.44:5081' - Username/auth name mismatch
```

Vài điều đáng chú ý. Thứ nhất, tần suất: bốn lần thử trong đúng hai giây, và số extension chạy tuần tự 100, 101, 102. Đây rõ ràng là script, không phải người. Thứ hai, phần lý do phía cuối mỗi dòng khác nhau: `Wrong password` nghĩa là extension có thật nhưng mật khẩu sai (nguy hiểm, vì kẻ tấn công biết mình đã tìm đúng một số máy), còn `No matching peer found` nghĩa là số đó không tồn tại. Kẻ tấn công đọc đúng những khác biệt này để lọc ra danh sách extension thật. Thứ ba, cổng nguồn `5081` cứ giữ nguyên trong một loạt, cho thấy chúng đang tái sử dụng một socket.

Với tổng đài dùng chan_sip cũ, có một chi tiết lịch sử đáng nhớ: mặc định Asterisk trả lời khác nhau cho extension tồn tại và không tồn tại, khiến việc enumeration dễ dàng. Về sau người ta thêm tùy chọn `alwaysauthreject=yes` để tổng đài luôn trả cùng một kiểu từ chối, bịt bớt kênh rò rỉ thông tin này. Nếu đang chạy `pjsip` hiện đại, hành vi mặc định đã an toàn hơn, nhưng nguyên tắc vẫn thế.

Một dạng log khác, từ máy trả về mã SIP thô, trông như sau:

```text
SIP/2.0 401 Unauthorized
SIP/2.0 403 Forbidden
```

`401` là "hãy xác thực lại", còn `403` là "tôi từ chối". Khi thấy một IP nhận về hàng trăm mã `403` trong một phút, không cần nghĩ nhiều nữa.

# Viết một filter và một jail

Fail2Ban đã đóng gói sẵn filter `asterisk`, nhưng mình muốn dựng lại một phiên bản tối giản để chúng ta thấy cơ chế. File filter đặt tại `/etc/fail2ban/filter.d/asterisk-custom.conf`:

```ini
[Definition]
failregex = ^.*Registration from '.*' failed for '<HOST>:\d+' - Wrong password$
            ^.*Registration from '.*' failed for '<HOST>:\d+' - No matching peer found$
            ^.*Registration from '.*' failed for '<HOST>:\d+' - Username/auth name mismatch$
ignoreregex =
```

Điểm mấu chốt là token `<HOST>`. Fail2Ban thay nó bằng một pattern nhận cả IPv4 lẫn IPv6, và bắt lấy kết quả để biết ban ai. Nếu regex của chúng ta không chứa `<HOST>`, jail sẽ không bao giờ ban được ai cả, đây là lỗi phổ biến nhất khi tự viết filter.

Trước khi tin tưởng, luôn kiểm thử filter trên log thật bằng công cụ `fail2ban-regex`:

```bash
fail2ban-regex /var/log/asterisk/messages \
  /etc/fail2ban/filter.d/asterisk-custom.conf
```

Lệnh này in ra số dòng khớp và số IP trích được. Nếu nó báo `0 matched`, filter sai chứ không phải log sạch.

Tiếp theo là jail, đặt trong `/etc/fail2ban/jail.d/asterisk.local` (luôn dùng file `.local` thay vì sửa `.conf` gốc để khỏi mất khi cập nhật gói):

```ini
[asterisk-custom]
enabled  = true
port     = 5060,5061,5081
protocol = udp
filter   = asterisk-custom
logpath  = /var/log/asterisk/messages
maxretry = 5
findtime = 600
bantime  = 86400
action   = %(action_)s
```

Diễn giải: năm lần đăng ký hỏng trong vòng **600** giây (mười phút) từ cùng một IP sẽ dẫn tới một lệnh ban kéo dài **86400** giây (một ngày). Với môi trường bị quét dày, nhiều người đặt `bantime = -1` để ban vĩnh viễn, hoặc bật chế độ **recidive** để những IP tái phạm nhiều lần bị chặn hàng tuần.

Sau khi nạp lại cấu hình, kiểm tra trạng thái jail:

```bash
fail2ban-client reload
fail2ban-client status asterisk-custom
```

Kết quả sẽ liệt kê số lần khớp tổng cộng, số IP đang bị chặn, và danh sách địa chỉ trong "banned IP list". Lần đầu nhìn con số này nhảy lên vài trăm chỉ sau một đêm, cảm giác vừa nhẹ nhõm vừa hơi rợn.

# Vài lưu ý để không tự bắn vào chân

Fail2Ban rất mạnh, và chính vì mạnh nên nó dễ chặn nhầm. Vài điều mình rút ra:

- **Whitelist dải IP tin cậy.** Đặt `ignoreip` cho subnet văn phòng và địa chỉ của chính các máy nhánh hợp lệ, nếu không một nhân viên gõ sai mật khẩu vài lần có thể tự khóa mình khỏi tổng đài.
- **UDP không có khái niệm "kết nối".** Phần lớn SIP chạy trên UDP, nên đừng trông chờ những dấu hiệu bắt tay TCP. Chúng ta đang lọc thuần túy dựa trên nội dung log ứng dụng, đó là lý do filter phải khớp thật chính xác.
- **Fail2Ban là lớp phòng thủ, không phải lớp duy nhất.** Nó giảm nhiễu và cản brute-force ngây thơ, nhưng một kẻ tấn công phân tán qua hàng nghìn IP (kiểu botnet) sẽ không chạm ngưỡng `maxretry` trên từng IP. Vì thế nó nên đi cùng: đặt tổng đài sau **VPN** hoặc **SBC** (*Session Border Controller*) khi có thể, đổi cổng SIP mặc định, đặt mật khẩu extension đủ dài và ngẫu nhiên, và bật `alwaysauthreject` hoặc dùng pjsip hiện đại để cắt kênh enumeration.
- **Đọc log định kỳ.** Fail2Ban chặn theo luật chúng ta viết, nhưng chính chúng ta mới nhìn ra một dạng tấn công mới trước khi viết được luật cho nó. Cái vòng "đọc log, chỉnh filter, kiểm thử bằng fail2ban-regex" là công việc không bao giờ thật sự kết thúc.

Thành thật mà nói, không có cấu hình nào chặn được tất cả. Một tổng đài mở ra Internet luôn là mục tiêu, và điều tốt nhất chúng ta làm được là nâng chi phí tấn công lên đủ cao để kẻ lười bỏ đi, đồng thời giữ cho bản thân đủ tỉnh táo để nhận ra khi kẻ kiên nhẫn xuất hiện. Fail2Ban làm rất tốt phần đầu tiên. Phần thứ hai vẫn nằm ở đôi mắt của chúng ta khi ngồi đọc từng dòng log lúc hai giờ sáng.

# Tài liệu tham khảo

- RFC 3261, *SIP: Session Initiation Protocol*, IETF.
- Fail2Ban, tài liệu và wiki chính thức trên GitHub (fail2ban/fail2ban).
- Asterisk documentation, *Security* và cấu hình chan_sip / pjsip (docs.asterisk.org).
- Manual page: `fail2ban-regex(1)` và `jail.conf(5)`.

---
title: Threat-model một máy chủ chạy cả blog lẫn PBX
excerpt: "Khi một cái máy vừa phục vụ trang blog tĩnh vừa chạy tổng đài VoIP, bề mặt tấn công không phải phép cộng mà là phép nhân."
permalink: /topics/threat-model-may-chu-blog-va-pbx/
categories:
  - topics
  - security
date: 2025-12-03 09:00
---

Trong các bài trước chúng ta đã mổ xẻ khá nhiều thứ chạy trên một con **VPS** nhỏ: một trang blog tĩnh, một cái **firewall** mềm, đôi khi là một con **PBX** (private branch exchange, tổng đài nội bộ) chạy **Asterisk** hoặc **FreeSWITCH** để nghịch **VoIP**. Mỗi thứ đứng riêng thì hiền lành. Vấn đề bắt đầu khi chúng ta nhét tất cả lên cùng một cái máy để tiết kiệm tiền thuê server.

Bài này không phải hướng dẫn cài đặt. Nó là một bài tập **threat modeling**: ngồi xuống và tự hỏi ai có thể tấn công cái máy này, qua đường nào, và nếu họ vào được thì hậu quả tới đâu. Về lý thuyết đây là việc nên làm *trước* khi mở port, nhưng thực tế phần lớn chúng ta làm nó sau khi đã bị quét log tơi tả.

# Threat model là gì?

**Threat model** là một mô tả có cấu trúc về những gì có thể sai. Có nhiều khung khác nhau, nhưng cách đơn giản nhất là trả lời bốn câu hỏi mà Adam Shostack hay nhắc: *chúng ta đang xây gì, cái gì có thể sai, chúng ta sẽ làm gì với nó, và chúng ta làm có ổn không.* Một khung phổ biến khác là **STRIDE** của Microsoft, phân loại mối đe dọa thành sáu nhóm: Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege.

Điểm mấu chốt: threat model gắn với **tài sản** (asset) chứ không gắn với công nghệ. Trên con máy của chúng ta có ba tài sản rất khác nhau về giá trị:

1. Nội dung blog. Public sẵn rồi, ai cũng đọc được. Mất mát lớn nhất là bị **defacement** (sửa trang) hoặc bị nhét mã độc vào để hại người đọc.
2. Khả năng gọi ra của PBX. Đây là thứ quy đổi trực tiếp ra **tiền**. Một tổng đài bị chiếm có thể tự động quay số quốc tế, gọi tới các đầu số premium, và để lại một hóa đơn bốn năm con số.
3. Quyền root trên máy. Nếu mất cái này thì hai cái trên chỉ là chuyện nhỏ.

# Bề mặt tấn công: phép nhân, không phải phép cộng

Khi hai dịch vụ dùng chung một kernel, một user-space, một filesystem, thì lỗ hổng của dịch vụ này trở thành bàn đạp cho dịch vụ kia. Đó là lý do mình nói bề mặt tấn công là phép nhân.

Hãy liệt kê các cổng thường mở:

| Dịch vụ | Cổng | Giao thức | Ai cần truy cập |
|---|---|---|---|
| Blog (HTTP/HTTPS) | 80, 443 | TCP | Cả thế giới |
| SSH quản trị | 22 | TCP | Chỉ mình chúng ta |
| SIP signaling | 5060, 5061 | UDP/TCP | Tùy, thường bị để mở toang |
| RTP media | 10000-20000 | UDP | Đối tác gọi |
| Asterisk Manager (AMI) | 5038 | TCP | Chỉ localhost |

Cái bảng này đã kể gần hết câu chuyện. Cổng **80/443** phải public, không tránh được. Cổng **5060** của **SIP** là nơi đau đầu nhất: các botnet quét cổng 5060 trên toàn IPv4 suốt ngày đêm, thử **REGISTER** với hàng nghìn extension đoán mò (`100`, `1000`, `admin`, `sip`) và mật khẩu yếu. Công cụ kinh điển là `sipvicious` (`svwar`, `svcrack`). Nếu con PBX của chúng ta chấp nhận đăng ký từ mọi IP với mật khẩu là `1234`, chuyện bị chiếm chỉ là vấn đề thời gian tính bằng giờ.

Còn dải **RTP** 10000-20000 là để mang thoại. Nó phải mở rộng, và đây chính là chỗ mà một firewall cấu hình cứng nhắc kiểu "chặn hết trừ vài port" sẽ làm hỏng cuộc gọi: signaling qua thì âm thanh một chiều, vì gói RTP bị **NAT** hoặc firewall nuốt mất.

# Những đường tấn công cụ thể

## SIP: đăng ký chùa và cước quốc tế

Đây là kịch bản gây thiệt hại tài chính lớn nhất và cũng phổ biến nhất. Kẻ tấn công dò ra một extension hợp lệ, crack được mật khẩu, rồi dùng nó để **REGISTER** như một máy nội bộ. Sau đó chúng gọi ra: thường là các đầu số vệ tinh hoặc premium-rate ở những vùng ít ai để ý, nơi chúng ăn chia doanh thu với nhà mạng đầu bên kia. Kiểu lừa này gọi là **International Revenue Share Fraud (IRSF)**. Cuộc tấn công hay xảy ra vào tối thứ Sáu để có trọn hai ngày cuối tuần chạy trước khi chúng ta phát hiện.

Phòng thủ ở tầng cấu hình:

- Đặt mật khẩu extension dài và ngẫu nhiên. Không bao giờ để extension trùng mật khẩu.
- Trong Asterisk, đặt `alwaysauthreject=yes` để server không tiết lộ extension nào tồn tại (nếu không, phản hồi khác nhau giữa "sai user" và "sai pass" chính là kênh rò rỉ thông tin, đúng nhóm Information disclosure của STRIDE).
- Giới hạn hướng gọi ra bằng dialplan. Nếu chúng ta không có nhu cầu gọi quốc tế, hãy chặn cứng mọi pattern `_9011.` hay `_00.` ngay trong context.
- Đặt trần chi phí hoặc cảnh báo với nhà cung cấp trung kế (**SIP trunk**) nếu họ có tùy chọn đó.

## Blog: từ một plugin lỗi tới cả cái máy

Nếu blog là tĩnh (Jekyll, Hugo build ra HTML rồi nginx phục vụ) thì bề mặt rất nhỏ, gần như chỉ còn rủi ro ở chính nginx và TLS. Nhưng nếu nó là **WordPress** hay CMS động, mỗi plugin là một cánh cửa. Một lỗ hổng **RCE** (remote code execution) trong plugin cho phép kẻ tấn công chạy lệnh dưới quyền của user chạy web (`www-data`).

Và đây là chỗ phép nhân hiện ra: từ `www-data`, kẻ tấn công đọc được file cấu hình Asterisk nếu quyền file lỏng lẻo, moi ra mật khẩu **SIP trunk** ghi thẳng trong `sip.conf` hoặc `pjsip.conf`, và giờ chúng không cần crack gì nữa. Một lỗi ở blog vừa trở thành lỗi ở PBX.

## SSH: cửa chính vẫn hay bị quên

Cổng 22 bị brute-force liên tục, ai chạy server công cộng đều thấy trong log. Biện pháp thì ai cũng biết mà hay lười làm: tắt đăng nhập mật khẩu, chỉ dùng khóa (`PasswordAuthentication no`), tắt `root` login trực tiếp, và cân nhắc dùng `fail2ban` để tự chặn IP dò mật khẩu.

# Phân đoạn: đừng để chung một sàn

Nguyên tắc cốt lõi khi buộc phải nhồi nhiều dịch vụ lên một máy là **phân đoạn** (segmentation): dựng tường ngăn để một dịch vụ bị thủng không kéo theo dịch vụ khác.

**Cô lập tiến trình và quyền.** Web server chạy dưới user riêng, Asterisk chạy dưới user riêng (Asterisk hỗ trợ chạy non-root qua `runuser`/`--group`). File cấu hình chứa bí mật phải `chmod 640` và thuộc về đúng group, để `www-data` không có cách nào đọc `pjsip.conf`. Đây là biện pháp rẻ nhất mà hiệu quả nhất chống lại kịch bản blog-tràn-sang-PBX ở trên.

**Cô lập mạnh hơn bằng container.** Bỏ blog vào một container, PBX vào một container khác. VoIP trong container hơi lằng nhằng vì dải RTP rộng và vì NAT, nhưng nếu dùng `network_mode: host` cho container PBX và giữ blog trong network riêng thì vẫn có được một ranh giới rõ ràng. Về lý thuyết một máy ảo (VM) riêng cho PBX còn cách ly tốt hơn container, đổi lại tốn RAM hơn.

**Firewall theo hướng, không chỉ theo cổng.** Đây là điểm nối với các bài về firewall trước. Với dịch vụ quản trị (SSH, AMI cổng 5038) hãy dùng **allowlist**: chỉ cho phép IP của chúng ta, mặc định chặn. AMI thì tốt nhất chỉ `bind` vào `127.0.0.1`, không bao giờ để lộ ra ngoài. Với SIP, nếu chúng ta chỉ làm việc với một nhà cung cấp trunk cố định, hãy chỉ cho phép signaling từ dải IP của họ và khóa cổng 5060 với phần còn lại của Internet. Chuyển từ tư duy "chặn cái xấu" sang "chỉ cho phép cái đã biết" là bước nhảy lớn nhất về an toàn.

```
# Ví dụ ý tưởng với nftables (không phải cấu hình copy-paste)
# SSH: chỉ IP quản trị
tcp dport 22 ip saddr { 203.0.113.10 } accept
# SIP: chỉ trunk provider
udp dport 5060 ip saddr { 198.51.100.0/24 } accept
# RTP: mở dải, nhưng chỉ UDP
udp dport 10000-20000 accept
# Web: public
tcp dport { 80, 443 } accept
```

# Giám sát: bạn không chặn hết được, nên phải nhìn thấy

Threat model không kết thúc ở phòng thủ. Phần thứ tư trong bốn câu hỏi là "làm có ổn không", và câu trả lời đến từ **giám sát** (monitoring). Với con máy hai vai này, ba tín hiệu đáng theo dõi nhất:

1. **Số cuộc gọi ra và đích đến.** Một đột biến số cuộc gọi tới đầu số quốc tế lúc 2 giờ sáng là dấu hiệu IRSF gần như chắc chắn. Asterisk ghi **CDR** (Call Detail Record); một script đơn giản đếm cuộc gọi theo giờ và cảnh báo khi vượt ngưỡng là đủ để cứu một hóa đơn khổng lồ.
2. **Đăng ký SIP thất bại và thành công lạ.** Log Asterisk (`full` log) cho thấy các lần REGISTER hỏng. Hàng nghìn lần hỏng từ một IP là botnet đang dò. Một lần *thành công* từ một IP nước ngoài chưa từng thấy thì đáng sợ hơn nhiều.
3. **Toàn vẹn file của blog.** Với site tĩnh, một công cụ kiểu `AIDE` hay chỉ đơn giản so hash thư mục web định kỳ sẽ báo ngay khi có file bị sửa hoặc thêm, tức defacement hoặc webshell.

Một điểm hay bị bỏ qua: hãy gửi log ra khỏi máy. Nếu kẻ tấn công lấy được root, việc đầu tiên chúng làm là dọn log tại chỗ. Log đã được đẩy sang một nơi khác (dù chỉ là một cái box `rsyslog` nhỏ) là bằng chứng duy nhất còn lại về những gì đã xảy ra, và đó cũng là cách duy nhất chống lại nhóm Repudiation trong STRIDE.

# Vậy có nên nhồi chung không?

Thành thật mà nói, threat model đẹp nhất cho tình huống này là *đừng chạy chung*. Tách PBX ra một máy riêng loại bỏ hẳn toàn bộ nhóm tấn công blog-tràn-sang-thoại, và biên giới giữa hai tài sản có giá trị rất khác nhau trở thành một biên giới vật lý thật.

Nhưng đó không phải lúc nào cũng là lựa chọn thực tế. Chúng ta chạy chung vì một con VPS rẻ hơn hai con, và với một cái blog cá nhân cộng một tổng đài để nghịch thì rủi ro tài chính có thể chấp nhận được, miễn là hướng gọi ra bị khóa chặt. Điều mình muốn để lại không phải một câu kết luận gọn gàng, mà là một thói quen: mỗi lần mở thêm một cổng trên cái máy đó, hãy dừng lại và hỏi cổng này nhân thêm bề mặt tấn công của những dịch vụ *khác* lên bao nhiêu. Câu hỏi đó, chứ không phải một danh sách quy tắc cứng, mới là cái giữ cho hóa đơn cuối tháng không bất ngờ.

# Tài liệu tham khảo

- Adam Shostack, *Threat Modeling: Designing for Security*, Wiley.
- Microsoft, tài liệu về mô hình **STRIDE** (Microsoft Threat Modeling / Security Development Lifecycle).
- Asterisk Documentation, mục về bảo mật SIP và `alwaysauthreject` (docs.asterisk.org).
- Asterisk Project, hướng dẫn "Seven Steps to Better SIP Security".
- Communications Fraud Control Association (CFCA), báo cáo thường niên về gian lận viễn thông, phần **IRSF**.
- OWASP, tài liệu về Threat Modeling.

---
title: WireGuard hay bastion host cổ điển
excerpt: "Đặt tunnel zero-trust cạnh mô hình bastion/DMZ cổ điển và xem chúng ta thực sự đang đánh đổi cái gì."
permalink: /topics/wireguard-hay-bastion-host/
categories:
  - topics
  - security
date: 2026-05-23 09:00
---


Mỗi khi cần cho một người từ Internet chạm được vào một máy nằm sâu trong mạng nội bộ, chúng ta đứng trước cùng một câu hỏi cũ: mở một cửa, hay dựng một đường hầm. **Bastion host** là cái cửa. **WireGuard** là cái đường hầm. Bài này mình muốn đặt hai thứ đó cạnh nhau, không phải để tuyên bố cái nào thắng, mà để nhìn cho rõ mỗi lựa chọn đang gánh giúp chúng ta phần rủi ro nào và đẩy phần rủi ro nào sang chỗ khác.

# Bài toán: truy cập từ xa vào thứ không nên phơi ra Internet

Về lý thuyết, một máy chủ database hay một bảng điều khiển quản trị không bao giờ nên có một **public IP** lắng nghe trực tiếp trên Internet. Lý do rất đơn giản: bất cứ port nào mở ra công cộng đều là một bề mặt tấn công **(attack surface)** bị quét liên tục, mỗi ngày, bởi các bot tự động. Chỉ cần một lỗ hổng chưa vá trong dịch vụ đó, hoặc một mật khẩu yếu, là xong.

Nhưng người vận hành thì vẫn phải vào được. Kỹ sư cần SSH vào máy, DBA cần nối tới cổng **5432** của Postgres, người trực đêm cần mở dashboard nội bộ. Vấn đề trở thành: làm sao cho đúng người vào được mà không biến cả khu vực nội bộ thành thứ ai cũng gõ cửa được.

Có hai trường phái trả lời câu hỏi này, và chúng đại diện cho hai triết lý mạng khác nhau.

# Bastion host: mô hình cái cổng thành

**Bastion host** (đôi khi gọi là **jump host** hoặc **jump box**) là một máy chủ được làm cứng **(hardened)** đặt ở vùng đệm giữa Internet và mạng nội bộ, thường là trong một **DMZ** (demilitarized zone). Nó là điểm duy nhất được phép nhận kết nối từ bên ngoài. Muốn vào máy nội bộ, bạn phải SSH vào bastion trước, rồi từ bastion mới nhảy tiếp vào bên trong.

Ý tưởng cốt lõi là **thu hẹp điểm vào**. Thay vì mười máy nội bộ mỗi máy mở một port ra Internet, chúng ta chỉ mở đúng một máy, và dồn toàn bộ công sức phòng thủ, giám sát, ghi log vào đúng máy đó.

## Lịch sử

Cái tên **bastion** mượn từ kiến trúc quân sự: pháo đài có những mấu lồi (bastion) nhô ra để tập trung hỏa lực phòng thủ. Trong ngành mạng, thuật ngữ này được phổ biến hóa qua bài viết kinh điển của **Marcus Ranum** đầu thập niên 1990 và sau đó được đóng đinh trong cuốn *Building Internet Firewalls* của **Chapman và Zwicky** (O'Reilly). Ở thời kỳ mà **firewall** dạng packet filter còn thô sơ, ý tưởng "một máy hy sinh, được làm cứng tối đa, đặt ngoài cùng" là một bước tiến lớn về tư duy phòng thủ theo lớp.

## Bastion trong thực tế trông thế nào

Một cấu hình SSH điển hình dùng bastion nhìn như sau ở phía client:

```ssh
Host bastion
    HostName bastion.example.com
    User ops
    IdentityFile ~/.ssh/id_ed25519

Host db-internal
    HostName 10.0.4.12
    User dba
    ProxyJump bastion
```

Khi gõ `ssh db-internal`, SSH tự động nối tới bastion trước rồi mở một đường xuyên qua nó tới `10.0.4.12`. Máy nội bộ không hề có route ra Internet, nó chỉ tin tưởng các kết nối đến từ bastion.

Điểm mạnh của mô hình này:

1. **Một điểm để canh gác.** Toàn bộ log truy cập, session recording, xác thực đa yếu tố đều gom về một chỗ. Muốn biết ai đã vào hệ thống đêm qua, chúng ta chỉ cần đọc log của bastion.
2. **Không cần phần mềm lạ trên máy đích.** Máy nội bộ chỉ chạy SSH server bình thường. Đây là ưu điểm với những hệ thống cũ, thiết bị mạng, hoặc chỗ mà chính sách không cho cài thêm gì.
3. **Chuẩn công nghệ đã chín.** SSH, firewall, DMZ là những thứ mọi sysadmin đều hiểu.

Điểm yếu cũng nằm ngay trong thiết kế:

1. **Bastion là mục tiêu tập trung.** Chiếm được bastion nghĩa là có bàn đạp vào toàn bộ nội bộ. Nó vừa là điểm phòng thủ, vừa là điểm thất bại đơn **(single point of failure)** nếu bị hạ.
2. **Bản thân nó vẫn lắng nghe công khai.** Port 22 của bastion vẫn phơi ra Internet, vẫn bị quét, vẫn ăn brute-force. Chúng ta chỉ thu nó về một máy chứ không làm nó biến mất.
3. **Vận hành thủ công dễ trôi.** Quản lý authorized_keys, xoay vòng khóa, gỡ quyền khi người nghỉ việc: tất cả đều là quy trình con người, và quy trình con người thì mục ruỗng theo thời gian.

# WireGuard: mô hình đường hầm mã hóa

**WireGuard** là một **VPN** hiện đại, gọn tới mức đáng ngạc nhiên: nhân của nó chỉ khoảng vài nghìn dòng code, so với hàng trăm nghìn dòng của IPsec hay OpenVPN. Nó được **Jason A. Donenfeld** viết, và từ phiên bản **5.6** đã được hợp nhất thẳng vào nhân **Linux** mainline, một dấu hiệu rất mạnh về chất lượng.

Thay vì mở một cửa để người ta gõ, WireGuard dựng một giao diện mạng ảo mã hóa giữa hai máy. Khi tunnel đã lên, máy từ xa hành xử như thể nó đang nằm ngay trong mạng nội bộ, với một địa chỉ IP nội bộ riêng.

## Vì sao nó khác về bản chất

Điểm khiến WireGuard thú vị dưới góc nhìn bảo mật không phải tốc độ, mà là cách nó xử lý gói tin lạ. WireGuard xác thực bằng cặp khóa công khai kiểu **Curve25519**, và có một tính chất gọi là **im lặng mật mã** **(cryptographic silence)**: nếu một gói UDP đến mà không được ký bởi một khóa mà nó đã biết, WireGuard vứt gói đó đi mà không trả lời gì cả.

Hệ quả rất lớn. Với con mắt của một máy quét Internet, cái port UDP của WireGuard trông như một port đóng, thậm chí như một máy không tồn tại. Không có banner, không có handshake để dò, không có gì để brute-force. Bạn không thể tấn công một dịch vụ mà bạn không chứng minh được là nó đang lắng nghe. Đây chính là tinh thần **zero-trust** ở tầng mạng: không chứng minh được danh tính bằng khóa thì thậm chí không tồn tại một cuộc hội thoại.

## Một cấu hình tối thiểu

Phía server, file `/etc/wireguard/wg0.conf` có thể gọn như sau:

```ini
[Interface]
Address = 10.100.0.1/24
ListenPort = 51820
PrivateKey = <khóa-riêng-của-server>

[Peer]
PublicKey = <khóa-công-khai-của-laptop-kỹ-sư>
AllowedIPs = 10.100.0.2/32
```

Phía client:

```ini
[Interface]
Address = 10.100.0.2/24
PrivateKey = <khóa-riêng-của-laptop>

[Peer]
PublicKey = <khóa-công-khai-của-server>
Endpoint = vpn.example.com:51820
AllowedIPs = 10.0.0.0/16
PersistentKeepalive = 25
```

Bật lên bằng `wg-quick up wg0`. Trường **AllowedIPs** ở đây làm hai việc cùng lúc: nó vừa là bảng định tuyến, vừa là danh sách kiểm soát truy cập mật mã. Peer này chỉ được phép gửi và nhận gói cho đúng dải IP ghi trong đó, không hơn.

## Đánh đổi của WireGuard

WireGuard không miễn phí về mặt chi phí vận hành, nó chỉ dời chi phí sang chỗ khác.

1. **Nó bảo vệ đường ống, không bảo vệ danh tính con người.** WireGuard trả lời câu hỏi "gói tin này có được ký bởi khóa hợp lệ không", chứ không trả lời "con người sau khóa này còn được phép vào không". Bản thân giao thức không có khái niệm hết hạn phiên, không có tích hợp danh bạ người dùng, không có xác thực đa yếu tố. Một khi laptop có khóa riêng, nó vào được cho tới khi bạn tự tay gỡ khóa công khai đó khỏi server.
2. **Quản lý khóa quy mô lớn là việc thật.** Mười người thì sửa file tay được. Năm trăm người, xoay vòng khóa, cấp và thu quyền theo nhóm thì bạn cần một lớp điều phối bên trên. Đây chính là chỗ các sản phẩm như **Tailscale** hay **Netbird** ra đời: chúng bọc WireGuard bằng một control plane lo phần danh tính và phân phối khóa.
3. **Tunnel phẳng dễ cấp quyền quá tay.** Vì máy từ xa hành xử như đang ở trong nội bộ, nếu **AllowedIPs** ghi rộng, một laptop bị chiếm sẽ có đường đi thẳng vào rất nhiều thứ. Nguyên tắc đặc quyền tối thiểu phải được thực thi cẩn thận qua từng peer và qua firewall nội bộ, chứ không tự động có.

# Vậy chọn cái nào

Mình nghĩ cách đặt câu hỏi "cái nào tốt hơn" là sai ngay từ đầu, vì hai thứ này bảo vệ hai tầng khác nhau và thực tế bổ sung cho nhau rất tốt.

Bastion mạnh ở tầng **kiểm toán danh tính con người**: ai vào, lúc nào, gõ lệnh gì, ghi lại được hết ở một điểm. WireGuard mạnh ở tầng **giấu bề mặt mạng**: biến port ra thành vô hình với kẻ quét, cắt đứt gần như toàn bộ tầng lớp tấn công brute-force và dò dịch vụ.

Một kiến trúc tỉnh táo thường xếp chồng cả hai. Đặt bastion host phía sau một endpoint WireGuard: kẻ tấn công ngoài Internet không nhìn thấy cả port 22 lẫn dịch vụ VPN theo cách thông thường, còn khi đã qua tunnel thì mọi truy cập vẫn bị dồn qua bastion để ghi log và soi. Lúc này WireGuard lo phần "chỉ những cỗ máy hợp lệ mới được phép nói chuyện", còn bastion lo phần "và đây chính xác là con người nào đã làm gì".

Nếu buộc phải chọn một, mình để lại vài câu hỏi thay cho kết luận. Bạn cần chứng minh *ai* đã truy cập, hay chỉ cần chặn kẻ lạ ngay từ cổng? Đội của bạn đủ kỷ luật để duy trì quy trình khóa và log thủ công không? Máy đích có cho cài thêm phần mềm không, hay là thiết bị cũ chỉ nói được SSH? Câu trả lời cho những câu này quyết định nhiều hơn là bản thân công nghệ. Zero-trust không phải một sản phẩm bạn mua, nó là một tư thế bạn phải liên tục giữ, và cả bastion lẫn WireGuard chỉ là công cụ để giữ tư thế đó.

# Tài liệu tham khảo

- WireGuard: Next Generation Kernel Network Tunnel, Jason A. Donenfeld (whitepaper chính thức tại wireguard.com)
- Tài liệu chính thức WireGuard: https://www.wireguard.com/
- *Building Internet Firewalls*, Elizabeth D. Zwicky, Simon Cooper, D. Brendan Chapman, O'Reilly
- Wikipedia: Bastion host
- Wikipedia: WireGuard
- NIST SP 800-207, Zero Trust Architecture

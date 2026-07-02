---
title: Chia mạng home lab bằng VLAN
excerpt: "Phân đoạn PBX, database và IoT đúng theo lý thuyết firewall, trên thiết bị thật."
permalink: /topics/chia-mang-home-lab-bang-vlan/
categories:
  - topics
  - electronics
date: 2026-01-17 09:00
---

# VLAN là gì?

Về lý thuyết, **VLAN** (Virtual LAN) là một cách chia một mạng vật lý phẳng thành nhiều mạng broadcast độc lập ở lớp 2 (Data Link) của mô hình **OSI**. Bình thường, khi chúng ta cắm tất cả thiết bị vào chung một switch, tất cả chúng nằm trong cùng một **broadcast domain**: một gói ARP broadcast do máy này gửi ra sẽ tới tai mọi máy khác. VLAN cắt cái miền broadcast đó thành nhiều mảnh, mỗi mảnh coi như một switch ảo riêng, dù chúng dùng chung một con switch vật lý.

Cơ chế để làm việc này là chuẩn **IEEE 802.1Q**. Nó chèn thêm 4 byte vào frame Ethernet, trong đó có một trường 12-bit gọi là **VID** (VLAN Identifier). 12 bit nghĩa là tối đa **4094** VLAN dùng được (0 và 4095 dành riêng). Cái tag này chỉ tồn tại trên đường **trunk** giữa các thiết bị mạng. Khi frame đi tới cổng **access** nối vào máy tính hay điện thoại thường, tag được gỡ ra, nên thiết bị đầu cuối không hề biết mình đang sống trong một VLAN.

Điểm mấu chốt mà mình muốn nhấn mạnh từ đầu: **VLAN tự nó không phải là firewall**. Hai VLAN khác nhau không nói chuyện được với nhau ở lớp 2, nhưng ngay khi chúng ta cắm một **router** hay một **layer 3 switch** để định tuyến giữa chúng, lưu lượng lại chảy tự do trở lại, trừ khi chúng ta đặt một tập luật kiểm soát ở điểm định tuyến đó. VLAN cho chúng ta ranh giới; firewall mới cho chúng ta chính sách trên ranh giới đó.

# Vì sao lại phải chia trong một home lab?

Nhiều người nghĩ nhà mình có mỗi cái router Wi-Fi thì chia làm gì. Nhưng một home lab hiện đại thường đang chứa những thứ rất khác nhau về mức độ tin cậy:

1. Máy tính cá nhân và điện thoại: nơi chúng ta gõ mật khẩu, đăng nhập ngân hàng.
2. Một dàn **IoT**: bóng đèn thông minh, camera, TV, robot hút bụi. Đây là nhóm phần mềm cập nhật chậm, hay gọi về máy chủ nước ngoài, và về mặt lịch sử là nguồn lỗ hổng dồi dào.
3. Một máy chủ tự dựng: có thể chạy **PBX** (tổng đài IP dùng SIP), một **database** như PostgreSQL, một NAS, vài container.
4. Mạng cho khách.

Đặt tất cả vào chung một lớp mạng phẳng nghĩa là một cái camera Trung Quốc giá rẻ bị chiếm quyền cũng có đường thẳng tới cổng 5432 của database và cổng 5060 của tổng đài. Nguyên tắc thiết kế firewall kinh điển ở đây là **least privilege** và **defense in depth**: mỗi nhóm chỉ được nói chuyện với đúng thứ nó cần, và ranh giới tin cậy nên có nhiều lớp chứ không phải một hàng rào duy nhất ngoài cùng.

# Thiết kế phân đoạn theo lý thuyết firewall

Trước khi cắm dây, mình luôn vẽ ra bảng **zone**. Mỗi VLAN là một zone với mức tin cậy riêng. Đây là sơ đồ mình hay dùng cho một lab nhỏ:

| VLAN ID | Tên zone | Subnet | Mức tin cậy | Nội dung |
|---------|----------|--------|-------------|----------|
| 10 | TRUSTED | 10.0.10.0/24 | Cao | Laptop, điện thoại của chủ nhà |
| 20 | SERVERS | 10.0.20.0/24 | Trung bình | PBX, database, NAS |
| 30 | IOT | 10.0.30.0/24 | Thấp | Camera, đèn, TV |
| 40 | GUEST | 10.0.40.0/24 | Không tin cậy | Khách |
| 99 | MGMT | 10.0.99.0/24 | Rất cao | Giao diện quản trị switch, router, AP |

Nguyên tắc viết luật giữa các zone nên tuân theo mấy điều sau, và đây chính là phần "lý thuyết firewall" thật sự:

- **Default deny.** Chiều mặc định giữa hai zone bất kỳ là chặn. Chúng ta chỉ mở đúng những luồng cần thiết. Đây là khác biệt căn bản so với "default allow rồi chặn cái xấu", vì chúng ta không bao giờ liệt kê hết được cái xấu.
- **Stateful.** Firewall hiện đại theo dõi trạng thái kết nối. Khi TRUSTED chủ động mở kết nối tới SERVERS, gói trả về được cho qua tự động nhờ bảng **conntrack**, mà không cần một luật ngược chiều. Nhờ vậy chúng ta chỉ cần khai báo chiều khởi tạo.
- **Hướng của luồng quan trọng hơn cặp địa chỉ.** "IOT được TRUSTED gọi vào" khác hoàn toàn với "IOT được phép gọi ra TRUSTED". Camera thì nên cho xem từ TRUSTED, nhưng tuyệt đối không cho camera tự mở kết nối ngược vào máy cá nhân.

Áp vào bảng trên, tập luật rút gọn trông như sau:

1. TRUSTED tới SERVERS: cho phép, chỉ các cổng dịch vụ cần thiết (SIP, SQL, SMB).
2. TRUSTED tới IOT: cho phép (để điều khiển đèn, xem camera).
3. IOT tới bất kỳ zone nội bộ nào: chặn. IOT chỉ được ra Internet.
4. SERVERS tới IOT và TRUSTED: chặn khởi tạo. Server không có lý do gì tự đi gõ cửa máy khách.
5. GUEST tới mọi zone nội bộ: chặn. Chỉ ra Internet.
6. Mọi zone tới MGMT: chặn, trừ TRUSTED (hoặc tốt hơn là chỉ một máy quản trị cụ thể).

# Phân đoạn PBX và database cho đúng

Đây là phần đáng nói nhất, vì PBX và database là hai loại dịch vụ có mô hình lưu lượng rất khác nhau, và người ta hay đặt sai.

## Database

**Database** gần như luôn là dịch vụ chỉ phục vụ nội bộ. Một PostgreSQL nghe ở cổng 5432 không có lý do gì để lộ ra IOT, GUEST, hay tệ hơn là Internet. Trong sơ đồ trên, database nằm ở VLAN 20 (SERVERS), và luật duy nhất cho nó là: chấp nhận kết nối 5432 từ đúng những host cần (ví dụ web app cũng nằm trong SERVERS, hoặc một máy TRUSTED khi mình cần chạy migration). Ngay cả trong cùng VLAN 20, nếu con NAS hay cái container linh tinh khác cũng ở đó, chúng ta nên siết thêm ở tầng host bằng `pg_hba.conf` và `listen_addresses`, chứ không dựa hết vào firewall biên. Đó lại là **defense in depth**: firewall lớp mạng hỏng thì còn kiểm soát ở lớp ứng dụng.

Một cạm bẫy phổ biến: đặt database và web frontend chung VLAN với IOT cho tiện. Đừng. Frontend có thể cần lộ ra ngoài, IOT thì bẩn, còn database thì phải sạch tuyệt đối. Ba mức tin cậy khác nhau, ba đối xử khác nhau.

## PBX (tổng đài SIP)

**PBX** khó hơn database vì bản chất giao thức. Một tổng đài IP thường dùng **SIP** cho báo hiệu (cổng UDP/TCP 5060, hoặc 5061 khi có TLS) và **RTP** cho luồng thoại thật, RTP dùng một dải cổng UDP động, ví dụ 10000 tới 20000. Đặc điểm này gây khó cho firewall stateful, vì địa chỉ và cổng RTP được thương lượng bên trong nội dung gói SIP (phần **SDP**), chứ không cố định.

Vài điểm mình luôn cân nhắc khi đặt PBX vào một VLAN riêng hoặc chung SERVERS:

- **Điện thoại IP nội bộ nên ở một VLAN thoại riêng** nếu có nhiều máy, vì thoại nhạy với độ trễ và jitter. Tách VLAN giúp gắn **QoS** ưu tiên cho lưu lượng RTP mà không đụng tới lưu lượng dữ liệu. Đây là lý do kỹ thuật, không chỉ bảo mật.
- **Cẩn thận với SIP ALG.** Nhiều router có tính năng SIP ALG tự sửa nội dung gói SIP để đục lỗ NAT cho RTP. Nghe thì hay, nhưng trên thực tế SIP ALG của thiết bị gia dụng thường viết ẩu và làm hỏng cuộc gọi nhiều hơn là giúp. Nếu tổng đài có trục trặc âm thanh một chiều, việc đầu tiên nên thử là **tắt SIP ALG** và tự khai báo dải cổng RTP trong firewall.
- **Nếu tổng đài cần nhận cuộc gọi từ nhà mạng SIP trunk bên ngoài**, đây là điểm phơi ra Internet, và nó là mục tiêu quét cổng 5060 liên tục. Ở đây least privilege nghĩa là chỉ cho phép IP của nhà cung cấp SIP trunk, thêm **fail2ban** để chặn brute-force đăng ký, và không bao giờ để cổng quản trị của PBX (giao diện web) nhìn ra ngoài.

Nói ngắn gọn: database là con thú chỉ ăn ở trong nhà, còn PBX là con thú đôi khi phải thò đầu ra cửa, nên hai chính sách firewall của chúng phải khác nhau.

# Làm trên thiết bị thật

Về mặt phần cứng, chúng ta cần hai thứ: một **managed switch** hỗ trợ 802.1Q, và một thiết bị làm nhiệm vụ định tuyến kèm firewall giữa các VLAN (router hỗ trợ VLAN, một con chạy **OpenWrt**, **pfSense**/**OPNsense**, hoặc **VyOS**). Router Wi-Fi phổ thông thường không đủ, vì chúng không cho viết luật giữa các subnet nội bộ.

Ý tưởng cấu hình chung:

1. Trên switch, đặt cổng nối lên router là **trunk**, cho phép đi qua tất cả VID cần thiết (10, 20, 30, 40, 99).
2. Các cổng nối thiết bị đầu cuối là **access**, gán đúng một VLAN. Cắm database vào cổng access VLAN 20, cắm camera vào cổng access VLAN 30.
3. Trên router, tạo một **sub-interface** cho mỗi VLAN, mỗi cái là default gateway của subnet tương ứng.
4. Viết tập luật firewall theo bảng zone ở trên, bắt đầu bằng default deny.

Trên một router chạy Linux, tạo interface VLAN 20 gắn vào card `eth0` trông như thế này:

```bash
# Tạo interface ảo cho VLAN 20 trên eth0
ip link add link eth0 name eth0.20 type vlan id 20
ip addr add 10.0.20.1/24 dev eth0.20
ip link set eth0.20 up
```

Và một ví dụ luật `nftables` diễn đạt đúng tinh thần default deny cộng stateful, cho phép TRUSTED đi tới database nhưng chặn IOT:

```
table inet filter {
  chain forward {
    type filter hook forward priority 0; policy drop;

    # Cho gói của kết nối đã thiết lập đi qua (stateful)
    ct state established,related accept

    # TRUSTED (VLAN 10) tới database trong SERVERS (VLAN 20)
    iifname "eth0.10" oifname "eth0.20" ip daddr 10.0.20.5 tcp dport 5432 accept

    # IOT (VLAN 30) chỉ được ra Internet, chặn mọi thứ vào nội bộ
    iifname "eth0.30" oifname "eth0.20" drop
    iifname "eth0.30" oifname "eth0.10" drop
  }
}
```

Chú ý dòng `policy drop` ở đầu chain: đó chính là default deny được viết ra thành một dòng. Mọi thứ không được cho phép tường minh đều bị bỏ. Dòng `ct state established,related accept` là phần stateful, nó cho phép chúng ta chỉ khai báo chiều khởi tạo mà không phải viết luật ngược cho gói trả về.

# Kết

VLAN không khó về mặt bấm cấu hình. Phần khó, và cũng là phần đáng học, là suy nghĩ về **zone** và **hướng luồng** trước khi chạm vào thiết bị. Một khi chúng ta đã quen nhìn mạng nhà mình như một tập các miền tin cậy với những cánh cửa được canh gác theo least privilege, thì cái home lab bắt đầu giống một hệ thống được thiết kế, chứ không phải một mớ dây cắm chung một switch.

Mình để ngỏ một điểm để bạn tự cân nhắc: nên tách bao nhiêu VLAN là đủ? Chia quá ít thì mất tác dụng phân đoạn, chia quá nhiều thì tập luật phình to tới mức chính chúng ta cũng không còn kiểm soát nổi, và một firewall mà người quản trị không hiểu hết cũng nguy hiểm chẳng kém gì không có firewall. Ranh giới hợp lý phụ thuộc vào việc bạn thật sự chạy những dịch vụ gì, chứ không có một con số vàng nào cả.

# Tài liệu tham khảo

- IEEE 802.1Q-2018, "Bridges and Bridged Networks" (tiêu chuẩn VLAN tagging).
- RFC 3261, "SIP: Session Initiation Protocol".
- RFC 3550, "RTP: A Transport Protocol for Real-Time Applications".
- Tài liệu OPNsense: Firewall và VLAN configuration (docs.opnsense.org).
- Tài liệu nftables trên wiki.nftables.org.
- Wikipedia: "Virtual LAN", "IEEE 802.1Q".

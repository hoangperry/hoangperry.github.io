---
title: nftables trong thực chiến
excerpt: "Chuyển lý thuyết firewall thành một ruleset nftables thật: stateful, NAT, logging, kiểm thử ngay trên máy chủ tại nhà."
permalink: /topics/nftables-trong-thuc-chien/
categories:
  - topics
  - security
date: 2026-06-28 09:00
---

Về lý thuyết, một **firewall** là một bộ lọc gói tin đặt giữa hai vùng mạng, quyết định gói nào được đi qua và gói nào bị chặn. Nghe thì đơn giản, nhưng khi chúng ta ngồi xuống viết ruleset thật cho một máy chủ đang chạy thì mới thấy khoảng cách giữa "chặn port 22" trong đầu và một tập luật đúng, không tự khoá mình ra ngoài, không rò rỉ, và vẫn đo đếm được. Bài này mình muốn đi hết quãng đường đó với **nftables**, framework lọc gói mặc định của nhân Linux hiện đại.

Mình sẽ viết như một buổi dựng máy chủ tại nhà: một con VPS hoặc một máy Linux trong LAN, chạy vài dịch vụ, và chúng ta muốn nó có một hàng rào tử tế.

# nftables là gì?

**nftables** là hệ thống lọc gói trong nhân Linux, ra mắt chính thức từ nhân **3.13** (năm 2014) để thay thế bộ công cụ cũ **iptables** (cùng họ với `ip6tables`, `arptables`, `ebtables`). Điểm mấu chốt: thay vì bốn công cụ riêng với bốn cú pháp, nftables gom tất cả vào một framework duy nhất, một ngôn ngữ luật duy nhất, và một tiện ích dòng lệnh duy nhất là `nft`. Bên dưới, nó dùng lại hạ tầng **Netfilter** (các hook trong đường đi của gói tin) mà iptables vẫn dùng, nên đây không phải là một cỗ máy hoàn toàn mới, mà là một lớp giao diện được thiết kế lại cho gọn.

## Vì sao đáng chuyển sang

Có vài lý do rất thực tế, không phải chạy theo mốt:

1. **Một bảng, nhiều họ địa chỉ.** Một luật có thể áp cho cả IPv4 lẫn IPv6 qua họ `inet`, thay vì phải viết đôi.
2. **Cú pháp khai báo, gần với cách chúng ta suy nghĩ.** Bạn khai báo `table`, trong đó có `chain`, trong `chain` có `rule`.
3. **`sets` và `maps` là công dân hạng nhất.** Muốn chặn một danh sách IP? Bỏ vào một set, thay vì hàng trăm dòng luật rời rạc.
4. **Nạp luật theo kiểu nguyên tử (atomic).** Cả file luật được nạp trong một giao dịch: hoặc thành công toàn bộ, hoặc không đổi gì. Không có cảnh nửa nạp xong thì đứt.

Điểm 4 nghe nhỏ nhưng nó cứu chúng ta khỏi trạng thái firewall "dở dang" giữa chừng, một trong những cách tự khoá mình ra khỏi máy chủ kinh điển.

# Ba khái niệm phải nắm trước khi gõ

Trước khi viết dòng luật đầu tiên, ba khái niệm này quyết định mọi thứ.

**Hook.** Netfilter đặt các điểm móc trên đường đi của gói tin. Với họ `inet`/`ip`, những hook chúng ta hay dùng là `prerouting`, `input`, `forward`, `output`, `postrouting`. Gói gửi tới chính máy này đi qua `input`. Gói máy này định tuyến giúp máy khác đi qua `forward`. NAT thường móc vào `prerouting` và `postrouting`.

**Stateful, tức là có theo dõi trạng thái kết nối.** Đây là trái tim của một firewall dùng được. Netfilter có module **conntrack** ghi nhớ mọi kết nối đang diễn ra. Nhờ đó, thay vì phải mở port cho cả chiều đi lẫn chiều về, chúng ta chỉ cần một luật: "cho qua mọi gói thuộc kết nối đã được thiết lập hoặc liên quan". Trạng thái conntrack gồm `new` (gói mở kết nối mới), `established` (thuộc kết nối đã có), `related` (liên quan, ví dụ gói lỗi ICMP của một kết nối), và `invalid` (không khớp trạng thái nào, thường nên vứt).

**Policy mặc định.** Mỗi base chain có một chính sách: `accept` hoặc `drop`. Nguyên tắc an toàn là **default deny**: đặt policy `drop`, rồi chỉ mở đúng những gì cần. Đây là khác biệt tư duy giữa "chặn cái xấu tôi biết" và "chỉ cho cái tốt tôi cần", và cái sau luôn bền hơn.

# Ruleset đầu tiên: bảo vệ chính máy chủ

Giả sử máy chủ chạy **SSH** (port 22), một web server (**80**/**443**), và không làm router. Ta chỉ cần lọc lưu lượng đi vào chính nó, tức chain `input`. File luật đặt tại `/etc/nftables.conf`:

```nft
#!/usr/sbin/nft -f

flush ruleset

table inet filter {
    chain input {
        type filter hook input priority 0; policy drop;

        # Gói của kết nối đã thiết lập hoặc liên quan: cho qua
        ct state established,related accept

        # Vứt gói invalid trước khi làm gì thêm
        ct state invalid drop

        # Loopback luôn tin cậy
        iif "lo" accept

        # ICMP/ICMPv6 cần thiết (ping, path MTU discovery, neighbor discovery)
        ip protocol icmp icmp type { echo-request, echo-reply, destination-unreachable, time-exceeded } accept
        ip6 nexthdr icmpv6 icmpv6 type { echo-request, echo-reply, nd-neighbor-solicit, nd-neighbor-advert, nd-router-advert } accept

        # Dịch vụ mở ra ngoài
        tcp dport 22 accept
        tcp dport { 80, 443 } accept

        # Mọi thứ còn lại rơi vào policy drop
    }

    chain forward {
        type filter hook forward priority 0; policy drop;
    }

    chain output {
        type filter hook output priority 0; policy accept;
    }
}
```

Vài điểm đáng dừng lại. Dòng `ct state established,related accept` đặt lên đầu là cố ý: phần lớn gói tin qua một chain thuộc về kết nối đang chạy, cho chúng qua sớm giúp tránh phải duyệt hết các luật phía dưới. Việc mở **ICMPv6** không phải tuỳ chọn với IPv6: **neighbor discovery** (`nd-neighbor-solicit`, `nd-neighbor-advert`) là tương đương của ARP trong IPv6, chặn nó là tự cắt kết nối IPv6 của mình. Đây là một cái bẫy rất hay gặp khi người ta bê tư duy "chặn hết ICMP cho chắc" từ IPv4 sang.

Chain `output` mình để `policy accept` cho gọn. Ở một máy chủ cứng hơn, bạn có thể siết cả chiều ra, nhưng hãy làm sau khi đã hiểu rõ máy đang cần nói chuyện với ai.

# Đừng tự khoá mình ra ngoài

Đây là phần thực chiến quan trọng nhất mà lý thuyết ít nhắc. Nếu bạn đang **SSH** vào con VPS ở xa và nạp một ruleset default-drop bị sai, phiên của bạn đứt và bạn mất luôn đường vào. Có hai thói quen cứu mạng.

Thứ nhất, kiểm thử bằng cách nạp có thời hạn. Trên **systemd**, dùng một hẹn giờ tự khôi phục: mở một phiên riêng chạy lệnh sẽ `flush ruleset` sau, chẳng hạn, 2 phút, rồi mới nạp luật mới ở phiên chính. Nếu luật mới khoá bạn, chỉ cần chờ 2 phút là firewall bị xoá và bạn vào lại được.

```bash
# Phiên A (cửa thoát hiểm): sau 120 giây sẽ mở toang lại
sleep 120 && nft flush ruleset &

# Phiên B: nạp luật mới và thử kết nối
sudo nft -f /etc/nftables.conf
```

Nếu sau khi thử thấy mọi thứ ổn, quay lại phiên A huỷ tiến trình `sleep`, rồi lưu luật cho khởi động sau. Thứ hai, luôn dùng `nft -c -f file` để kiểm tra cú pháp trước khi nạp thật; cờ `-c` chỉ kiểm mà không áp dụng.

# Thêm NAT: khi máy chủ làm router

Nếu máy này định tuyến cho một mạng con phía sau (ví dụ một mạng lab, hoặc một đám container), chúng ta cần **NAT**. Trường hợp phổ biến nhất là **source NAT** kiểu **masquerade**: giấu toàn bộ mạng nội bộ sau một địa chỉ công cộng duy nhất trên giao diện ra ngoài.

NAT trong nftables sống ở một table riêng, với các chain móc vào hook `postrouting` (đổi địa chỉ nguồn, sau khi định tuyến xong) và `prerouting` (đổi địa chỉ đích, trước khi định tuyến, dùng cho port forwarding).

```nft
table inet nat {
    chain postrouting {
        type nat hook postrouting priority srcnat; policy accept;

        # Giấu subnet nội bộ sau IP của card mạng ra internet
        ip saddr 10.0.0.0/24 oif "eth0" masquerade
    }

    chain prerouting {
        type nat hook prerouting priority dstnat; policy accept;

        # Chuyển tiếp cổng: 8080 bên ngoài về một máy nội bộ
        iif "eth0" tcp dport 8080 dnat to 10.0.0.5:80
    }
}
```

Hai điều bắt buộc kèm theo. Một, phải bật chuyển tiếp gói tin trong nhân, nếu không mọi luật `forward` đều vô nghĩa:

```bash
sudo sysctl -w net.ipv4.ip_forward=1
# và cho IPv6 nếu cần: net.ipv6.conf.all.forwarding=1
```

Hai, chain `forward` trong table `filter` phải thực sự cho phép lưu lượng đi qua, vì nó vẫn đang là `policy drop`. Một cặp luật tối thiểu:

```nft
# Bổ sung vào chain forward của table inet filter
ct state established,related accept
ip saddr 10.0.0.0/24 oif "eth0" accept
```

Ở đây mình cố tình tách bạch: **filter** quyết định gói có được đi qua không, **nat** quyết định gói bị viết lại địa chỉ ra sao. Trộn hai việc này trong đầu là nguồn gốc của rất nhiều giờ debug. Một điểm nữa thường gây bối rối: DNAT viết lại địa chỉ đích ở `prerouting`, nhưng luật `filter` ở `forward` lại nhìn thấy địa chỉ đích **đã bị viết lại** (10.0.0.5), không phải địa chỉ ban đầu. Vì thứ tự hook là `prerouting` rồi mới tới `forward`.

# Logging: nhìn thấy cái mình đang chặn

Một firewall câm là một firewall khó tin. Chúng ta muốn thấy cái gì đang bị vứt, ít nhất trong lúc dựng. nftables ghi log qua nhật ký nhân, và bạn có thể gắn tiền tố để lọc về sau:

```nft
# Đặt ngay trước khi gói rơi vào policy drop của chain input
log prefix "nft-input-drop: " level info
```

Log rồi drop có thể tách làm hai bước như trên (gói không khớp luật nào sẽ được log rồi mới bị policy `drop` nuốt). Xem kết quả bằng:

```bash
sudo journalctl -k -f | grep "nft-input-drop"
```

Một lưu ý thực tế: đừng log mọi gói bị drop trên một máy chủ công cộng thật. Internet quét port liên tục, log của bạn sẽ phình ra rất nhanh và tự nó thành một vấn đề. Cách lành mạnh là dùng **rate limit** cho chính dòng log, để bạn thấy được mẫu tấn công mà không chết chìm:

```nft
limit rate 5/minute log prefix "nft-input-drop: " level info
```

# Kiểm thử: chứng minh luật làm đúng việc

Viết luật xong chưa phải là xong. Chúng ta cần quan sát cả trạng thái lẫn hành vi.

Xem toàn bộ ruleset đang chạy, kèm bộ đếm nếu đã bật:

```bash
sudo nft list ruleset
```

Bật bộ đếm trên một luật bằng từ khoá `counter` để đo lưu lượng thật:

```nft
tcp dport 22 counter accept
```

Sau đó `nft list ruleset` sẽ hiện số gói và số byte đã khớp luật đó, cách nhanh nhất để trả lời câu hỏi "luật này có thực sự được dùng không". Từ một máy khác trong LAN, thử quét vài port để xác nhận cái đóng thì đóng, cái mở thì mở:

```bash
# Từ máy khác trỏ vào IP máy chủ
nmap -Pn -p 22,80,443,3306 192.168.1.10
```

Bạn muốn thấy 22/80/443 ở trạng thái `open`, còn 3306 (giả sử MySQL chỉ nghe nội bộ) ở `filtered`. Nếu 3306 hiện `closed` thay vì `filtered`, đó là dấu hiệu gói bị nhân từ chối (RST) chứ không phải bị firewall lặng lẽ nuốt, một khác biệt tinh tế nhưng nói lên luật của bạn chưa bao trùm port đó. Cuối cùng, để luật sống sót qua khởi động lại, bật service:

```bash
sudo systemctl enable --now nftables
```

# Lưu lại vài suy nghĩ chưa gọn

Đến đây chúng ta đã có một firewall stateful đúng nghĩa: default-deny, cho phép kết nối đã thiết lập, mở đúng dịch vụ, làm NAT khi cần, và có mắt để nhìn. Nhưng mình không muốn kết bài kiểu "và thế là bạn đã an toàn", vì thật ra ranh giới ở đây khá mờ.

Một firewall gói tin lọc theo địa chỉ và cổng; nó gần như mù trước những gì xảy ra bên trong một kết nối đã mở. Web server của bạn nghe trên 443 và firewall vui vẻ cho qua, còn lỗ hổng trong ứng dụng phía sau thì nó không thấy. Với **conntrack**, có những đánh đổi về bộ nhớ và về cách xử lý gói `invalid` mà mình đã lược đi để bài không dài quá. Và câu hỏi "nên siết chiều `output` tới mức nào" thì không có đáp án chung, nó phụ thuộc bạn tin máy chủ của mình tới đâu.

Điều mình thấy đáng giá nhất khi tự tay viết ruleset, thay vì bật một GUI hay copy một script, là nó buộc mình phát biểu rõ ràng máy chủ được phép nói chuyện với ai. Phần lớn thời gian, chính việc phải viết ra điều đó đã dạy nhiều hơn bản thân tập luật.

# Tài liệu tham khảo

- nftables project wiki, "What is nftables?" và "Quick reference-nftables in 10 minutes" (wiki.nftables.org)
- `nft(8)` manual page, Netfilter project
- Netfilter/iptables project (netfilter.org), tài liệu về conntrack và các hook
- Arch Linux Wiki, mục "nftables"
- Wikipedia, "nftables" và "Netfilter"

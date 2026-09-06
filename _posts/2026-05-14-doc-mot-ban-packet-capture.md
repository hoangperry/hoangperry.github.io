---
title: Đọc một bản packet capture
excerpt: "Mổ xẻ một luồng TCP bằng tcpdump và Wireshark, rồi nối ngược lại với access policy theo giá trị IP và protocol."
permalink: /topics/doc-mot-ban-packet-capture/
categories:
  - topics
  - security
date: 2026-05-14 09:00
---

Có một kỹ năng mà mình nghĩ ai làm hạ tầng hay bảo mật cũng nên có: mở một file `.pcap` ra và đọc được nó đang kể chuyện gì. Không phải để làm màu, mà vì rất nhiều lúc log của ứng dụng nói dối, log của firewall thì mơ hồ, còn gói tin thì không biết nói dối. Nó là thứ thật nhất mà chúng ta có: đúng những byte đã chạy qua dây.

Bài này mình đi qua một luồng **TCP** từ lúc bắt, tới lúc đọc từng lớp, rồi cuối cùng nối lại với **access policy** trên firewall theo giá trị **IP** và **protocol**. Mình cố giữ nó thực tế, dùng đúng công cụ mà chúng ta hay có sẵn: **tcpdump** để bắt, **Wireshark** (hoặc **tshark**) để mổ xẻ.

## Packet capture là gì?

Về lý thuyết, **packet capture** là việc sao chép lại các khung dữ liệu đi qua một giao diện mạng, rồi lưu chúng ra đĩa theo một định dạng đọc được sau này. Định dạng phổ biến là **pcap** và bản mới hơn là **pcapng**. Mỗi bản ghi trong file gồm một timestamp, độ dài gói, và toàn bộ các byte đã bắt được, thường bắt đầu từ lớp liên kết (**Ethernet**) trở lên.

Điểm quan trọng: capture không diễn giải gì cả. Nó chỉ chép byte. Việc diễn giải "đây là một cái SYN của TCP" là do phần mềm đọc (Wireshark) làm sau, dựa trên chồng giao thức. Cho nên khi đọc, chúng ta luôn đọc theo từng lớp: **Ethernet -> IP -> TCP/UDP -> payload**. Mô hình quen thuộc ở đây là chồng **TCP/IP**, và mỗi lớp bọc lớp trên nó lại (encapsulation).

## Bắt gói bằng tcpdump

`tcpdump` là công cụ dòng lệnh gọn nhất để bắt. Trên một máy Linux, để bắt lưu lượng tới một web server và ghi ra file, mình hay dùng:

```bash
sudo tcpdump -i eth0 -n -s 0 -w capture.pcap 'tcp port 443 and host 203.0.113.10'
```

Giải thích nhanh vài cờ, vì mỗi cái đều có lý do:

1. `-i eth0`: chọn giao diện cần bắt. Dùng `-i any` nếu muốn bắt hết mọi interface (nhưng khung sẽ ở dạng linux "cooked", hơi khác Ethernet chuẩn).
2. `-n`: đừng phân giải DNS ngược. Nếu không, `tcpdump` sẽ tự đi hỏi DNS và làm bẩn chính bản capture của bạn.
3. `-s 0`: bắt toàn bộ độ dài gói (snap length không giới hạn). Ngày xưa mặc định hay cắt ngắn payload, làm mất dữ liệu tầng ứng dụng.
4. `-w capture.pcap`: ghi nhị phân ra file thay vì in ra màn hình.
5. Phần trong nháy đơn là **BPF filter** (Berkeley Packet Filter): chỉ bắt những gì khớp. Ở đây là TCP cổng 443 và có liên quan tới host `203.0.113.10`.

Cái **BPF filter** này là filter lúc bắt (capture filter). Nó khác với display filter của Wireshark, chỗ này rất dễ nhầm. Capture filter quyết định gói nào được ghi xuống đĩa, nên nếu lọc sai lúc bắt thì mất luôn, không lấy lại được. Vì vậy khi chưa chắc, mình thường bắt rộng rồi lọc hẹp lúc đọc.

Muốn xem nhanh tại chỗ mà không mở Wireshark, thêm `-A` (in payload dạng ASCII) hoặc `-X` (hex kèm ASCII):

```bash
sudo tcpdump -i eth0 -n -A 'tcp port 80 and host 203.0.113.10'
```

## Bắt tay ba bước của TCP

Trước khi mở Wireshark, cần nhắc lại luồng mà chúng ta sẽ đi tìm. Một kết nối **TCP** luôn mở đầu bằng **three-way handshake**:

1. Client gửi một gói có cờ **SYN**, kèm một số thứ tự khởi đầu (sequence number).
2. Server trả lại **SYN, ACK**: vừa xác nhận SYN của client, vừa gửi sequence number của chính nó.
3. Client gửi **ACK** để chốt. Từ đây kết nối ở trạng thái **ESTABLISHED** và dữ liệu bắt đầu chảy.

Khi đóng, chúng ta sẽ thấy **FIN, ACK** ở cả hai chiều, hoặc một cú **RST** nếu ai đó cắt phũ. Cái đẹp của việc đọc capture là ba bước này hiện ra rõ mồn một, và nếu nó không hiện ra đủ, đó chính là manh mối.

## Mở bằng Wireshark và lọc lại

Mở `capture.pcap` trong Wireshark, việc đầu tiên là thu hẹp tầm nhìn bằng **display filter**. Display filter khác BPF ở chỗ nó chỉ ẩn/hiện chứ không xoá gì, nên cứ thoải mái gõ. Vài filter mình dùng gần như mỗi ngày:

```text
ip.addr == 203.0.113.10
tcp.port == 443
tcp.flags.syn == 1 and tcp.flags.ack == 0
tcp.analysis.retransmission
tcp.stream eq 0
```

Dòng `tcp.flags.syn == 1 and tcp.flags.ack == 0` lọc ra đúng các gói SYN thuần (client mở kết nối), rất tiện để đếm xem có bao nhiêu lần thử bắt tay. Dòng `tcp.analysis.retransmission` cho thấy gói bị truyền lại, tức là có mất mát hoặc nghẽn đâu đó. Còn `tcp.stream eq 0` gom đúng một cuộc hội thoại TCP lại thành một luồng, để chúng ta không bị lẫn giữa nhiều kết nối song song.

Một mẹo rất thực dụng: chuột phải vào một gói bất kỳ trong luồng và chọn **Follow -> TCP Stream**. Wireshark sẽ ráp lại toàn bộ payload theo đúng thứ tự sequence number, hiển thị hai chiều bằng hai màu. Với HTTP thô, bạn đọc thẳng ra request và response. Với TLS thì chỉ thấy dữ liệu mã hoá, nhưng phần bắt tay (**ClientHello**, **ServerHello**) vẫn ở dạng rõ và nói cho bạn biết SNI, phiên bản, bộ mã.

## Đọc từng lớp của một gói

Chọn một gói SYN đầu luồng, khung chi tiết của Wireshark bung ra theo đúng chồng giao thức. Mình đọc từ dưới lên:

1. **Frame**: siêu dữ liệu do capture thêm vào, gồm timestamp và độ dài. Không phải dữ liệu trên dây, chỉ là ghi chú của công cụ.
2. **Ethernet II**: địa chỉ **MAC** nguồn và đích, cùng trường EtherType (0x0800 nghĩa là bên trong là IPv4). Lớp này chỉ có ý nghĩa trong phạm vi một chặng L2.
3. **Internet Protocol**: đây là chỗ có **IP** nguồn và đích, **TTL**, và trường **Protocol**. Với TCP, trường Protocol mang giá trị `6`. Con số này quan trọng, mình sẽ quay lại nó ở phần policy.
4. **Transmission Control Protocol**: cổng nguồn, cổng đích (443), sequence và acknowledgment number, và quan trọng nhất là các cờ. Ở gói đầu chúng ta muốn thấy đúng cờ **SYN** bật, các cờ khác tắt.

Nếu bạn thích dòng lệnh, `tshark` in ra đúng những trường này mà không cần giao diện:

```bash
tshark -r capture.pcap -Y 'tcp.flags.syn==1' \
  -T fields -e ip.src -e ip.dst -e ip.proto -e tcp.dstport -e tcp.flags
```

Lệnh này cho ra một bảng gọn gàng: IP nguồn, IP đích, số hiệu protocol, cổng đích, và cờ. Đây gần như chính là ngôn ngữ mà một access policy nói.

## Nối capture với access policy

Đây là phần mình thấy hay nhất, vì nó biến việc đọc gói từ một trò tò mò thành một công cụ chẩn đoán thật.

Một **access policy** trên firewall, về bản chất, là một danh sách luật có thứ tự, mỗi luật khớp gói theo vài trường rồi quyết định **allow** hay **deny**. Những trường mà luật hay dùng chính là những trường chúng ta vừa đọc trong capture:

- **IP nguồn và đích** (từ lớp IP).
- **Protocol** (trường Protocol của IP: `6` cho TCP, `17` cho UDP, `1` cho ICMP).
- **Cổng nguồn và đích** (từ lớp TCP hoặc UDP).

Hãy tưởng tượng một luật rất đời thường, viết theo kiểu iptables:

```bash
iptables -A INPUT -p tcp -s 203.0.113.10 --dport 443 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j DROP
```

Luật đầu cho phép TCP tới cổng 443 nếu nguồn là `203.0.113.10`. Luật sau chặn mọi TCP tới 443 còn lại. Bây giờ ghép nó với những gì đọc được trong capture:

- Nếu chúng ta thấy đủ **SYN -> SYN,ACK -> ACK**, nghĩa là gói khớp luật ACCEPT và chính sách đang cho qua. Đường đi thông.
- Nếu chỉ thấy **SYN** lặp lại nhiều lần, cách nhau đều đặn (thường theo cấp số nhân do TCP tự thử lại), mà không có SYN,ACK đáp, thì gói nhiều khả năng bị một luật **DROP** nuốt im lặng. Firewall vứt gói và không nói gì, nên client cứ kiên nhẫn gửi lại.
- Nếu thấy một **RST** trả về gần như tức thì sau SYN, đó thường là kiểu từ chối chủ động: có thể là luật **REJECT** (khác DROP), hoặc đúng là không có dịch vụ nào nghe ở cổng đó.

Chính sự khác nhau giữa "im lặng" và "bị đá về" đã là một thông tin chẩn đoán. **DROP** làm client treo tới khi timeout, còn **REJECT** hoặc cổng đóng làm client thất bại nhanh. Chỉ cần nhìn có RST hay không, chúng ta đã đoán được kiểu luật đang tác động, mà không cần đăng nhập vào firewall.

Cách nối này rất máy móc, và đó là điểm mạnh của nó. Lấy `ip.src`, `ip.dst`, `ip.proto`, `tcp.dstport` từ capture, đặt cạnh bảng luật, dò xem gói khớp luật nào đầu tiên (vì luật xử lý theo thứ tự trên xuống). Kết quả khớp đó phải giải thích được hành vi bạn thấy trên dây. Nếu không khớp, hoặc là bạn đọc sai luật, hoặc có một thiết bị khác (NAT, một firewall khác, một security group) đang chen vào giữa.

Nhân tiện nói tới **NAT**: nếu giữa client và server có NAT, thì IP nguồn bạn thấy ở hai đầu capture sẽ khác nhau. Bắt ở phía client thấy IP nội bộ, bắt ở phía server thấy IP đã dịch. Khi đối chiếu với policy, phải biết luật đang viết theo IP trước hay sau khi dịch. Đây là chỗ người ta hay chẩn đoán nhầm nhất, và cũng là lý do vì sao đôi khi cần bắt ở cả hai đầu rồi so timestamp và cổng để ghép cặp lại đúng luồng.

## Một quy trình đọc gọn

Gộp lại, khi cầm một capture để điều tra một kết nối nghi bị chặn, mình thường đi thế này:

1. Lọc về đúng luồng: `ip.addr == <đích> and tcp.port == <cổng>`, hoặc khoá theo `tcp.stream`.
2. Tìm gói **SYN** đầu tiên. Có SYN,ACK đáp lại không?
3. Nếu có: handshake xong, vấn đề nằm ở tầng cao hơn (ứng dụng, TLS, HTTP), không phải ở access policy L3/L4.
4. Nếu chỉ có SYN lặp lại: nghi **DROP**. Đối chiếu `ip.proto` và cổng với các luật deny.
5. Nếu có **RST** nhanh: nghi **REJECT** hoặc cổng đóng. Kiểm tra dịch vụ và luật reject.
6. Kiểm tra **retransmission** để loại trừ nguyên nhân mất gói thuần tuý (mạng tậm tịt) trước khi đổ lỗi cho policy.

Mình để ý là bước 3 hay bị bỏ qua. Rất nhiều lần "firewall chặn" thật ra là handshake TCP hoàn tất bình thường, còn lỗi nằm ở TLS bắt tay thất bại hay ứng dụng trả về mã lỗi. Capture giúp chúng ta phân định rạch ròi ranh giới đó: tới đâu là mạng, từ đâu là ứng dụng.

## Kết

Đọc packet capture, nói cho cùng, là tập nhìn cùng một sự việc ở nhiều lớp: MAC ở L2, IP ở L3, cờ TCP ở L4, và payload ở trên. Access policy cũng chỉ đang đọc vài trong số những trường đó rồi ra phán quyết. Khi bạn quen với việc lấy `ip.src`, `ip.dst`, `ip.proto`, cổng từ một gói và soi ngược vào bảng luật, thì phần lớn các ca "không kết nối được" sẽ tự phân loại thành vài nhóm rất rõ.

Mình không nghĩ có một kết luận gọn ghẽ kiểu "cứ làm X là xong", vì mỗi hạ tầng có cách chen NAT, proxy, và stateful inspection riêng. Nhưng cái khung ở trên, đọc theo lớp rồi ghép với luật theo IP và protocol, thì gần như luôn là điểm khởi đầu đúng. Phần còn lại là kiên nhẫn cuộn qua từng gói.

## Tài liệu tham khảo

- tcpdump và libpcap, tài liệu chính thức: tcpdump.org
- Wireshark User's Guide và tham chiếu display filter: wireshark.org
- RFC 9293, Transmission Control Protocol (TCP)
- RFC 791, Internet Protocol (định nghĩa trường Protocol và IPv4 header)
- IANA Protocol Numbers (bảng số hiệu cho trường Protocol của IP)
- Trang man của iptables và netfilter, netfilter.org

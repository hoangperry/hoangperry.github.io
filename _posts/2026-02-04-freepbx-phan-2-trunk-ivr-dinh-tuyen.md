---
title: "FreePBX phần 2: trunk, IVR và định tuyến cuộc gọi"
excerpt: "Phần trước dựng xong tổng đài nội bộ. Phần này là lúc nó nói chuyện được với thế giới bên ngoài."
permalink: /topics/freepbx-phan-2-trunk-ivr-dinh-tuyen/
categories:
  - topics
  - electronics
date: 2026-02-04 09:00
---

Ở phần trước, chúng ta đã dựng được một tổng đài **FreePBX** chạy trên **Asterisk**, tạo vài **extension** và gọi nội bộ cho nhau. Nhưng một tổng đài chỉ gọi được trong nhà thì cũng giống như một mạng LAN không có **gateway** ra Internet: vui thì có vui, dùng thật thì chưa. Phần này mình muốn đi nốt nửa còn lại: làm sao để một cuộc gọi từ điện thoại nội bộ đi ra ngoài số di động thật (**outbound**), và làm sao để một cuộc gọi từ bên ngoài gọi vào rồi được dẫn tới đúng người (**inbound** và **DID**).

*Về cơ bản, tổng đài của chúng ta cần ba thứ: một đường ra ngoài, một bộ luật để quyết định gọi số nào thì đi đường nào, và một người gác cổng để đón cuộc gọi vào.*

# Trunk là gì?

**Trunk** là đường kết nối giữa tổng đài của chúng ta và thế giới bên ngoài, thường là nhà cung cấp dịch vụ thoại. Ngày xưa trunk là những đường vật lý thật: một đường **analog** (**FXO**, cắm dây điện thoại đồng như ở nhà), hoặc một luồng số kiểu **ISDN PRI** với 30 kênh thoại chạy trên một sợi **E1**. Muốn gọi được 30 cuộc đồng thời thì phải thuê nguyên một luồng E1, và phải có card giao tiếp cắm vào máy chủ.

Ngày nay đại đa số trunk là **SIP trunk**, tức là kết nối qua **VoIP** dùng giao thức **SIP** (**Session Initiation Protocol**) để thiết lập cuộc gọi và **RTP** (**Real-time Transport Protocol**) để tải luồng âm thanh. Không còn dây đồng, không còn card, chỉ là các **packet** đi qua Internet hoặc qua một đường truyền riêng tới **ITSP** (**Internet Telephony Service Provider**). Ở Việt Nam thì các nhà mạng và nhiều nhà cung cấp thoại doanh nghiệp đều bán loại SIP trunk này, thường tính theo số kênh đồng thời và theo phút gọi.

Điểm hay của SIP trunk là số kênh không còn bị đóng cứng theo phần cứng nữa. Muốn 5 kênh hay 50 kênh chỉ là chuyện cấu hình và hợp đồng, miễn là băng thông đủ. Mỗi cuộc gọi thoại nén bằng **codec** như **G.711** ngốn khoảng 64 kbit/s cho phần payload, chưa kể overhead của header, nên khi tính đường truyền cho một trunk nhiều kênh thì đừng quên nhân lên.

## Cấu hình một SIP trunk

Trong FreePBX, trunk được khai báo ở **Connectivity -> Trunks**. Với một SIP trunk (driver **chan_pjsip** là mặc định của các bản Asterisk hiện đại), nhà cung cấp sẽ đưa cho chúng ta một bộ thông tin quen thuộc:

1. **Host** hoặc **SIP server**: địa chỉ máy chủ của nhà cung cấp, dạng `sip.nhacungcap.vn`.
2. **Username** và **Secret**: tài khoản và mật khẩu để đăng ký (**register**).
3. **DID** hoặc dải số: (những) số điện thoại thật mà nhà cung cấp gán cho chúng ta.

Có hai kiểu xác thực chính. Kiểu **registration** là tổng đài chủ động gửi gói **REGISTER** lên nhà cung cấp để báo "tôi đang online, số này ở chỗ tôi", giống hệt cách một softphone đăng ký về tổng đài. Kiểu **IP authentication** thì không cần đăng ký, hai bên tin nhau qua địa chỉ IP cố định, thường dùng khi chúng ta có IP tĩnh và đường truyền riêng. Với người mới, kiểu register thường dễ hơn vì không phụ thuộc IP tĩnh.

Một khối cấu hình pjsip cho phần **pjsip Settings** của trunk thường trông đại loại như sau (FreePBX sinh ra hộ chúng ta phần lớn, nhưng biết mặt nó vẫn tốt):

```ini
[nhacungcap]
type=registration
transport=transport-udp
outbound_auth=nhacungcap_auth
server_uri=sip:sip.nhacungcap.vn
client_uri=sip:0123456789@sip.nhacungcap.vn
retry_interval=60
```

Sau khi lưu và **Apply Config**, chúng ta có thể kiểm tra trạng thái đăng ký ngay trong console của Asterisk:

```bash
asterisk -rx "pjsip show registrations"
```

Nếu thấy trạng thái **Registered** thì trunk đã bắt tay xong với nhà cung cấp. Nếu thấy **Rejected** hoặc **Failed** thì gần như luôn là sai username/secret, sai host, hoặc **firewall** đang chặn cổng SIP (mặc định UDP 5060). Đây cũng là lúc nhắc lại: SIP và **NAT** là một cặp oan gia kinh điển, mình sẽ nói ở cuối bài.

# Outbound Route: dẫn cuộc gọi ra ngoài

Có trunk rồi nhưng khi bấm số di động, tổng đài vẫn chưa biết phải đẩy cuộc gọi qua đường nào. Đó là việc của **Outbound Route** (**Connectivity -> Outbound Routes**). Nói ngắn gọn, outbound route là một bảng luật: nếu số người dùng bấm khớp một mẫu nào đó, thì gửi cuộc gọi qua trunk tương ứng.

Cái cần hiểu ở đây là **dial pattern**, mẫu quay số. FreePBX dùng một cú pháp mẫu kế thừa từ Asterisk:

- `X` khớp một chữ số bất kỳ từ 0 đến 9.
- `Z` khớp một chữ số từ 1 đến 9.
- `N` khớp một chữ số từ 2 đến 9.
- `[1-5]` khớp một chữ số trong khoảng liệt kê.
- `.` khớp một hoặc nhiều ký tự còn lại (dùng cẩn thận, nó tham lam).

Ví dụ, để cho phép gọi mọi số di động Việt Nam 10 chữ số bắt đầu bằng 0, ta có thể đặt mẫu khớp phần **match pattern** là `0XXXXXXXXX`. Muốn gọi cố định nội hạt, gọi quốc tế thì thêm các mẫu khác. Một tổng đài thật thường có nhiều outbound route xếp theo thứ tự ưu tiên: route gọi khẩn cấp và nội bộ đặt trên cùng, route quốc tế đặt dưới, và Asterisk sẽ duyệt từ trên xuống, dùng route đầu tiên khớp.

Outbound route còn hai công dụng mà trong doanh nghiệp người ta rất hay dùng:

1. **Sửa số trước khi gửi** (**prepend / prefix / manipulation**). Ví dụ người dùng quen bấm 9 để "lấy đường ra ngoài" rồi mới bấm số thật. Ta đặt mẫu bỏ chữ số 9 đầu rồi mới gửi phần còn lại cho nhà cung cấp. Hoặc nhà cung cấp yêu cầu số quốc tế phải có tiền tố `+84` thay vì `0`, ta để route tự thay.
2. **Chặn quyền gọi**. Bằng cách gắn outbound route với **Class of Service** hoặc đơn giản là không cho một số extension nào chạm tới route quốc tế, ta ngăn được chuyện lễ tân gọi điện đi nước ngoài cả ngày. Chuyện nghe nhỏ nhưng hóa đơn thoại quốc tế thì không nhỏ.

Điểm dễ vấp của người mới là quên rằng thứ tự route quan trọng. Nếu một route với mẫu `.` (khớp tất cả) nằm trên cùng, thì mọi cuộc gọi sẽ chui hết vào đó và các route phía dưới không bao giờ được dùng đến.

# Inbound Route và DID: đón cuộc gọi vào

Chiều ngược lại: có người gọi vào số thật của chúng ta, cuộc gọi đi qua trunk và rơi vào tổng đài. Bây giờ tổng đài phải quyết định dẫn nó đi đâu. Đó là **Inbound Route** (**Connectivity -> Inbound Routes**).

Cái khóa để phân loại cuộc gọi vào là **DID** (**Direct Inward Dialing**), tức chính là số điện thoại mà người ta đã bấm để gọi tới. Nếu chúng ta chỉ có một số, mọi cuộc gọi vào có cùng một DID, ta chỉ cần một inbound route. Nhưng nếu nhà cung cấp cấp cho ta một dải số, ví dụ mỗi phòng ban một số, thì ta tạo nhiều inbound route, mỗi route khớp một DID và dẫn tới một đích khác nhau. Đây chính là ý nghĩa của chữ "direct inward": người bên ngoài gọi thẳng vào máy trong nội bộ mà không cần qua tổng đài viên.

Ngoài DID, inbound route còn khớp được theo **Caller ID**, tức số của người gọi tới. Nhờ vậy ta làm được những luật kiểu chặn một số quấy rối, hoặc ưu tiên khách VIP đi thẳng tới một nhân viên chăm sóc.

Mỗi inbound route trỏ tới một **đích** (**destination**). Đích có thể là:

- Một **extension** cụ thể (đổ chuông thẳng một máy).
- Một **Ring Group** (đổ chuông nhiều máy cùng lúc hoặc lần lượt).
- Một **Queue** (hàng đợi, dùng cho tổng đài chăm sóc khách hàng).
- Một **IVR**, tức menu trả lời tự động, thứ mình muốn nói kỹ hơn ngay dưới đây.

# IVR: người gác cổng biết nói

**IVR** (**Interactive Voice Response**) là cái giọng "xin bấm phím 1 để gặp phòng kinh doanh, phím 2 để gặp kỹ thuật" mà ai gọi tổng đài doanh nghiệp cũng từng nghe. Về bản chất nó chỉ là một cây quyết định: phát một đoạn ghi âm, chờ người gọi bấm phím trên bàn phím (tín hiệu **DTMF**), rồi dựa vào phím đó mà nhảy tới đích tương ứng.

Trong FreePBX, IVR nằm ở **Applications -> IVR**. Để dựng một IVR cơ bản chúng ta cần:

1. **Một lời chào ghi âm** (**Announcement**). FreePBX quản lý các file âm thanh ở **Admin -> System Recordings**. Ta có thể tải lên file thu sẵn, hoặc thu qua chính một extension trong tổng đài. Lưu ý định dạng: Asterisk thích các file **WAV** PCM 8 kHz, 16-bit, mono; tải lên định dạng lạ đôi khi phát ra tiếng rè hoặc câm.
2. **Các mục trong menu** (**IVR Entries**). Mỗi mục gắn một phím với một đích: phím 1 tới Ring Group kinh doanh, phím 2 tới hàng đợi kỹ thuật, phím 0 tới lễ tân.
3. **Các luật xử lý ngoại lệ**. Người gọi bấm sai phím thì làm gì (**Invalid**), người gọi im lặng không bấm gì thì làm gì (**Timeout**). Thông thường ta cho quay lại phát menu vài lần rồi mới đẩy về lễ tân, tránh để cuộc gọi treo vô định.

Một điều dễ bị quên là IVR có thể lồng nhau. Phím 2 của menu chính có thể dẫn tới một IVR con "kỹ thuật phần cứng bấm 1, phần mềm bấm 2". Rất tiện, nhưng cũng rất dễ lạm dụng. Về mặt trải nghiệm, hiếm người gọi nào đủ kiên nhẫn với một cây menu sâu ba bốn tầng. Kinh nghiệm chung là giữ menu nông và luôn chừa một phím về người thật.

Ghép lại, một luồng inbound điển hình trông như thế này:

```text
Cuộc gọi vào số 02812345678 (DID)
      -> Inbound Route khớp DID
      -> IVR "Chào mừng quý khách..."
            phím 1 -> Ring Group Kinh doanh
            phím 2 -> Queue Kỹ thuật
            phím 0 -> Extension 100 (Lễ tân)
            timeout / invalid -> phát lại, sau 3 lần -> Lễ tân
```

Ngoài giờ hành chính thì sao? FreePBX có **Time Conditions** và **Time Groups** để phân luồng theo giờ và theo ngày. Trong giờ làm việc thì inbound route dẫn vào IVR như trên; ngoài giờ thì dẫn thẳng tới một lời nhắn "hiện đã ngoài giờ làm việc" hoặc vào **Voicemail**. Đây là chỗ mà một tổng đài phần mềm ăn đứt tổng đài cứng đời cũ: đổi luật theo giờ chỉ là vài cú click, không phải gọi kỹ thuật viên tới.

# Cái bẫy quen thuộc: SIP và NAT

Mình không thể kết bài mà không nhắc tới nỗi khổ kinh điển của mọi người mới chơi VoIP. SIP là giao thức nhét địa chỉ IP vào ngay trong phần thân bản tin (khối **SDP**), chứ không chỉ ở header IP. Khi tổng đài của chúng ta nằm sau **NAT**, nó tự khai địa chỉ **private** (kiểu `192.168.x.x`) vào trong SDP, và đầu bên kia không tài nào gửi luồng RTP về đúng chỗ. Kết quả rất đặc trưng: cuộc gọi kết nối được, chuông reo bình thường, nhưng nhấc máy lên thì **một chiều im lặng** hoặc im cả hai chiều.

Cách xử lý thường gặp:

- Khai báo **External Address** và dải **Local Networks** trong **Settings -> Asterisk SIP Settings** để Asterisk biết địa chỉ public thật của mình mà ghi vào SDP.
- Mở đúng cổng trên firewall: UDP 5060 cho tín hiệu SIP, và dải cổng RTP (mặc định UDP 10000 đến 20000) cho luồng âm thanh.
- Cân nhắc dùng nhà cung cấp có hỗ trợ NAT tốt, hoặc đặt tổng đài trên máy chủ có IP public nếu điều kiện cho phép.

Đây là loại lỗi không nằm ở cấu hình trunk hay route, nên người mới hay đi tìm nhầm chỗ. Nếu register OK, cuộc gọi thiết lập được mà chỉ mất tiếng, hãy nghĩ tới NAT và RTP trước tiên.

# Kết

Tới đây thì bức tranh đã tương đối trọn vẹn: extension để gọi nội bộ, trunk để nối ra ngoài, outbound route quyết định số nào đi đường nào, inbound route và DID đón cuộc gọi vào, IVR làm người gác cổng, time condition trực ngoài giờ. Nói vậy chứ mình cũng thành thật: cái khó của tổng đài thật ít khi nằm ở việc hiểu từng khối, mà nằm ở việc ghép chúng lại sao cho khớp thói quen thật của một tổ chức, và ở những chi tiết vặt như codec, NAT, chất lượng đường truyền. FreePBX cho chúng ta bộ công cụ khá đầy đủ, phần còn lại là chịu khó thử, đọc log, và chấp nhận rằng lần đầu dựng gần như chắc chắn sẽ vấp ở đâu đó. Mà thật ra, vấp rồi tự gỡ được mới là phần vui nhất của trò này.

# Tài liệu tham khảo

- FreePBX Documentation, Sangoma (wiki.freepbx.org)
- Asterisk Documentation, Sangoma (docs.asterisk.org)
- RFC 3261, "SIP: Session Initiation Protocol", IETF
- RFC 3550, "RTP: A Transport Protocol for Real-Time Applications", IETF
- Wikipedia: "Direct inward dial", "Interactive voice response"

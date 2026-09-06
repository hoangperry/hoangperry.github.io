---
title: Tự dựng máy chủ trên Raspberry Pi
excerpt: "Nhật ký phần cứng: nguồn, tản nhiệt và cài headless cho một máy chủ tí hon chạy 24/7."
permalink: /topics/tu-dung-may-chu-tren-raspberry-pi/
categories:
  - topics
  - electronics
date: 2026-01-26 09:00
---


## Máy chủ tại nhà là gì?

Về lý thuyết, một **máy chủ** (server) không phải là một loại máy tính đặc biệt nào cả. Nó chỉ là một máy tính được cấu hình để chạy liên tục và phục vụ yêu cầu từ những máy khác trong mạng: cấp file, chạy website, giải quyết truy vấn **DNS**, đồng bộ dữ liệu. Điều làm nó khác một chiếc laptop bình thường là kỳ vọng về **uptime**: nó phải bật gần như mọi lúc, kể cả khi chúng ta ngủ.

Một chiếc **Raspberry Pi** hợp với vai trò này một cách bất ngờ. Nó là một máy tính nhúng chạy vi xử lý kiến trúc **ARM**, tiêu thụ chỉ vài watt, và im lặng tuyệt đối vì phần lớn model không có quạt. Với một máy chạy 24/7, hai đặc tính đó (điện năng thấp và không tiếng ồn) quan trọng hơn nhiều so với sức mạnh thô. Bài này là một cuốn nhật ký phần cứng: mình sẽ đi qua ba thứ mà người mới hay xem nhẹ nhưng lại quyết định việc máy có chạy ổn định hay không, đó là **nguồn**, **tản nhiệt** và cách cài đặt **headless** (không màn hình).

## Nguồn: thủ phạm số một

Nếu phải chọn một nguyên nhân gây ra những lỗi khó hiểu nhất trên Raspberry Pi, mình sẽ chọn **nguồn điện**. Rất nhiều báo cáo kiểu "thẻ nhớ bị hỏng", "máy tự khởi động lại", "USB rớt kết nối" thật ra bắt nguồn từ việc cấp điện không đủ, chứ không phải lỗi phần mềm.

Vấn đề nằm ở hiện tượng **undervoltage** (sụt áp). SoC của Pi cần điện áp ổn định quanh **5V**. Khi CPU tăng tải hoặc khi ổ đĩa USB rút dòng lớn, dòng điện tức thời tăng vọt. Nếu bộ sạc yếu hoặc sợi cáp có điện trở cao, điện áp tại chân cắm của Pi tụt xuống dưới ngưỡng an toàn (thường lấy mốc khoảng **4.63V**). Firmware phát hiện điều này và bắt đầu **throttle** (giảm xung nhịp) để tự bảo vệ, hoặc tệ hơn là gây lỗi ghi dữ liệu.

Vài con số thực dụng để tham khảo:

1. **Raspberry Pi 4** chính thức yêu cầu nguồn **5V/3A** qua cổng USB-C, tức khoảng **15W**.
2. **Raspberry Pi 5** ngốn hơn và khuyến nghị nguồn **5V/5A** (**25W**) nếu muốn cấp đủ dòng cho các thiết bị USB ngoại vi; với nguồn 5V/3A nó vẫn chạy nhưng sẽ giới hạn dòng ra cổng USB.
3. Sợi cáp cũng là một phần của mạch. Cáp USB rẻ tiền, dài, lõi mỏng có điện trở đáng kể; theo định luật Ohm, sụt áp trên cáp là `V = I * R`, nên khi dòng `I` lớn thì phần điện áp mất trên cáp càng cao.

Cách kiểm tra sụt áp không cần đồng hồ đo. Hệ điều hành đã ghi lại sự kiện này:

```bash
# Xem cờ throttling hiện tại (0x0 nghĩa là ổn)
vcgencmd get_throttled

# Đọc nhật ký kernel để tìm cảnh báo undervoltage
dmesg | grep -i voltage
```

Nếu `get_throttled` trả về khác `0x0`, hãy nghi ngờ nguồn hoặc cáp trước tiên. Kinh nghiệm gọn: dùng đúng bộ nguồn chính hãng, cáp ngắn và dày, và tránh cấp điện cho Pi qua cổng USB của máy tính khác.

## Tản nhiệt: im lặng nhưng có giới hạn

Con SoC trên Pi không có quạt theo mặc định, nên nó tản nhiệt thụ động qua vỏ chip ra không khí. Với tải nhẹ thì ổn. Nhưng một máy chủ thật sự (biên dịch code, phục vụ nhiều kết nối, chạy container) sẽ đẩy CPU lên tải cao kéo dài, và lúc đó nhiệt là vấn đề vật lý không né được.

Cơ chế tự vệ của Pi là **thermal throttling**. Khi nhiệt độ SoC chạm ngưỡng (mặc định khoảng **80°C** bắt đầu giảm nhẹ, và **85°C** là mốc giảm mạnh), firmware hạ xung nhịp CPU/GPU để nhiệt không tiếp tục leo. Máy không hỏng, nhưng nó chậm lại, và với một máy chủ thì hiệu năng dập dềnh theo nhiệt độ là điều khó chịu.

Đọc nhiệt độ realtime rất đơn giản:

```bash
# Nhiệt độ SoC
vcgencmd measure_temp

# Hoặc đọc trực tiếp từ sysfs (đơn vị: phần nghìn độ C)
cat /sys/class/thermal/thermal_zone0/temp
```

Về mặt giải pháp, có một thang bậc rõ ràng, đi từ nhẹ tới nặng:

1. **Heatsink** (miếng tản nhiệt nhôm dán lên chip). Rẻ, thụ động, hạ được vài độ. Đủ cho tải trung bình.
2. **Vỏ kim loại làm heatsink**. Cả cái case đóng vai trò khối nhôm tản nhiệt, tiếp xúc chip qua miếng thermal pad. Vẫn im lặng tuyệt đối.
3. **Quạt chủ động**. Hạ nhiệt tốt nhất nhưng đánh đổi bằng tiếng ồn và một điểm hỏng cơ khí. Riêng Raspberry Pi 5 có đầu cắm quạt chuyên dụng và firmware điều khiển tốc độ quạt theo nhiệt, nên quạt chỉ quay khi cần.

Lựa chọn phụ thuộc vào việc máy đặt ở đâu và làm gì. Một máy chủ file đặt trong tủ, tải thấp, thì một cái heatsink nhôm là quá đủ. Một máy build hay chạy nhiều container đặt cạnh chỗ ngủ thì mình sẽ cân nhắc vỏ nhôm để vừa mát vừa yên tĩnh.

## Cài đặt headless

Một máy chủ đúng nghĩa thì không cần màn hình, bàn phím hay chuột. Chúng ta cấu hình nó một lần rồi điều khiển hoàn toàn qua mạng bằng **SSH**. Cách làm này gọi là **headless**, và điểm hay là ta chuẩn bị được mọi thứ ngay trên thẻ nhớ trước cả khi cắm điện lần đầu.

Công cụ chính thức là **Raspberry Pi Imager**. Nó không chỉ ghi ảnh hệ điều hành vào thẻ **microSD**, mà còn cho phép ghi trước cấu hình khởi động đầu tiên:

1. Chọn OS (mình dùng bản **Raspberry Pi OS Lite**, không giao diện đồ họa, vì máy chủ không cần desktop).
2. Vào phần cài đặt nâng cao (biểu tượng bánh răng) và bật **SSH**, đặt **hostname**, tên đăng nhập và mật khẩu, khai báo sẵn Wi-Fi nếu không dùng dây mạng.
3. Ghi vào thẻ, cắm vào Pi, cấp nguồn. Sau khoảng một phút, máy đã lên mạng và sẵn sàng nhận SSH.

Từ máy tính chính, chúng ta kết nối vào:

```bash
# Kết nối lần đầu; thay hostname và user theo cấu hình đã đặt
ssh pi@raspberrypi.local

# Sau khi vào, việc đầu tiên luôn là cập nhật hệ thống
sudo apt update && sudo apt full-upgrade -y
```

Nếu `raspberrypi.local` không phân giải được (một số router không hỗ trợ **mDNS** tốt), hãy vào trang quản trị router để tìm địa chỉ **IP** mà Pi được cấp, rồi SSH thẳng vào IP đó. Một mẹo nhỏ đáng làm sớm: đặt **DHCP reservation** trên router để Pi luôn nhận cùng một IP, tránh cảnh hôm nay một địa chỉ mai một địa chỉ.

Về bảo mật, vì máy chạy 24/7 nên vài bước cơ bản là nên có: đổi mật khẩu mặc định (Imager đã ép làm điều này), và tốt hơn là chuyển sang đăng nhập bằng **SSH key** thay vì mật khẩu.

```bash
# Chạy trên máy tính chính: tạo cặp khóa nếu chưa có
ssh-keygen -t ed25519

# Copy khóa công khai lên Pi
ssh-copy-id pi@raspberrypi.local
```

Sau khi khóa hoạt động, có thể tắt hẳn đăng nhập mật khẩu trong `/etc/ssh/sshd_config`. Đây là thay đổi đáng giá nhất cho một máy luôn bật.

## Một lưu ý về lưu trữ

Điểm yếu cố hữu của Pi khi làm máy chủ là thẻ **microSD**. Bộ nhớ flash loại này có số lần ghi hữu hạn, và một máy chủ ghi log liên tục sẽ bào mòn thẻ nhanh hơn ta tưởng. Thẻ hỏng thường không báo trước, một hôm máy đơn giản là không boot nữa.

Có vài hướng giảm rủi ro, mỗi hướng một mức công sức. Nhẹ nhàng thì dùng thẻ chất lượng tốt và sao lưu định kỳ toàn bộ ảnh thẻ. Bài bản hơn thì cho Pi (từ đời 4 trở đi hỗ trợ **USB boot**) khởi động thẳng từ **SSD** gắn qua USB, vừa bền hơn nhiều vừa nhanh hơn hẳn thẻ nhớ. Mình sẽ không đi sâu ở đây, nhưng nếu định giao cho Pi một việc gì đó quan trọng dài hạn thì đây là nâng cấp nên tính tới.

## Kết

Dựng một máy chủ trên Raspberry Pi thú vị ở chỗ nó buộc chúng ta nghĩ về những thứ mà máy tính để bàn giấu kín: điện áp có đủ không, nhiệt thoát đi đâu, dữ liệu ghi lên môi trường nào. Phần mềm thì luôn có thể cài lại, nhưng ba yếu tố phần cứng ở trên (nguồn, tản nhiệt, lưu trữ) mới là thứ quyết định con máy tí hon này có thật sự chạy được hàng tháng trời mà ta quên nó đi hay không.

Mình để ngỏ câu chuyện lưu trữ và chuyện chọn giữa quạt hay tản thụ động, vì thành thật mà nói câu trả lời phụ thuộc rất nhiều vào việc bạn định giao cho nó làm gì. Một máy chạy **Pi-hole** chặn quảng cáo và một máy build phần mềm là hai bài toán nhiệt hoàn toàn khác nhau. Cái hay của việc tự dựng là bạn sẽ dần cảm được ranh giới đó qua chính con `vcgencmd` và những lần máy tự khởi động lại lúc nửa đêm.

## Tài liệu tham khảo

- Raspberry Pi Documentation, mục "Power supply" và "Frequency management and thermal control" (raspberrypi.com/documentation).
- Raspberry Pi Documentation, "Getting started" và "Remote access" (hướng dẫn Imager, SSH, headless).
- Wikipedia, "Raspberry Pi".
- Manpage của `ssh`, `sshd_config`, `vcgencmd`.

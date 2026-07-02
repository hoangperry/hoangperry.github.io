---
title: Turboprop hay turbofan hiệu quả hơn
excerpt: "Số cánh quạt và bypass ratio thắng ở dải tốc độ nào, và tại sao không có câu trả lời duy nhất."
permalink: /topics/turboprop-hay-turbofan/
categories:
  - topics
  - aviation
date: 2026-03-03 09:00
---

Ở hai bài trước chúng ta đã nói về hiệu suất của **cánh quạt** theo hệ số tiến **J**, và về nguyên lý của **động cơ phản lực**. Bài này mình muốn nối hai câu chuyện đó lại: khi đặt một **turboprop** (động cơ tuabin kéo cánh quạt) cạnh một **turbofan** (động cơ phản lực có quạt), cái nào hiệu quả hơn? Câu trả lời không nằm ở "loại động cơ nào tốt hơn" mà nằm ở dải tốc độ mà chiếc máy bay thực sự bay.

*Về bản chất, cả hai đều là cùng một trò chơi: đẩy một khối không khí về phía sau để lấy lực đẩy về phía trước.*

# Cùng một lõi, khác cách tiêu thụ

Cả **turboprop** lẫn **turbofan** đều dùng chung một lõi khí động gọi là **gas generator**: máy nén khí, buồng đốt, và **turbine**. Khác biệt nằm ở chỗ năng lượng nóng ở đuôi lõi được xài vào việc gì.

Ở một động cơ phản lực thuần túy (**turbojet**), gần như toàn bộ năng lượng thoát ra thành một luồng khí nóng tốc độ rất cao. Nhưng ở **turboprop**, người ta đặt thêm nhiều tầng turbine phía sau để hút gần hết năng lượng đó, biến nó thành **shaft power (W)** quay một cánh quạt lớn qua một hộp số giảm tốc. Luồng khí xả ở đuôi chỉ còn đóng góp một phần nhỏ lực đẩy, thường được nói khoảng dưới **10 phần trăm** tổng lực đẩy ở chế độ cất cánh.

**Turbofan** nằm giữa hai thái cực. Nó vẫn có một luồng khí nóng qua lõi (**core / hot stream**), nhưng phần lớn turbine được dùng để quay một cái **fan** lớn ở đầu động cơ. Cái fan đó thổi một khối không khí lạnh đi vòng qua bên ngoài lõi, gọi là **bypass stream**. Tỉ số giữa khối lượng khí đi vòng ngoài và khối lượng khí đi qua lõi chính là **bypass ratio**.

Nói ngắn gọn: turboprop là turbofan với **bypass ratio** cực lớn, chỉ khác là "cái fan" của nó không nằm trong vỏ mà là một cánh quạt trần lộ ra ngoài.

# Tại sao đẩy nhiều khí chậm lại hiệu quả hơn

Đây là điểm mấu chốt và cũng là chỗ nối trực tiếp với bài cánh quạt. Lực đẩy **(N)** sinh ra bằng lưu lượng khối khí nhân với độ thay đổi vận tốc của nó, đại khái `F = m_dot * (v_e - v_0)`, trong đó `v_e` là vận tốc khí ra và `v_0` là vận tốc bay.

Vấn đề là năng lượng động học bạn phải bỏ ra lại tỉ lệ với **bình phương** vận tốc. Có hai cách tạo cùng một lực đẩy:

1. Đẩy một khối khí **nhỏ** ra thật **nhanh** (turbojet).
2. Đẩy một khối khí **lớn** ra chậm hơn nhiều (turboprop, turbofan bypass cao).

Cách thứ hai luôn hiệu quả hơn về nhiên liệu, vì phần năng lượng bị bỏ phí dưới dạng động năng thừa của luồng khí xả nhỏ hơn. Đây gọi là **propulsive efficiency**, và về mặt lý thuyết nó cao nhất khi vận tốc khí xả càng gần vận tốc bay càng tốt.

Chính vì vậy một cánh quạt lớn, hoặc một fan **bypass ratio** cao, luôn "ăn xăng" ít hơn một luồng phản lực nhỏ và nóng khi bay ở tốc độ vừa phải. Đó cũng là lý do suốt mấy chục năm qua **bypass ratio** của động cơ hàng không dân dụng cứ tăng dần, từ khoảng 1 ở thế hệ đầu lên tới quãng 10 tới 12 ở các động cơ hiện đại.

# Vậy sao không dùng cánh quạt cho mọi thứ?

Nếu đẩy nhiều khí chậm luôn hiệu quả hơn, đáng lẽ turboprop phải thắng tuyệt đối. Nhưng ở đây bài cánh quạt quay lại ám chúng ta.

Nhớ lại hệ số tiến **J = v / (nD)** và cái đường cong hiệu suất theo **J**. Cánh quạt chỉ đạt hiệu suất cao trong một khoảng **J** nhất định. Khi máy bay bay càng nhanh, vận tốc dòng khí tới đầu mút cánh quạt (**tip**) là tổng hợp của vận tốc bay và vận tốc quay. Đầu mút cánh quạt là chỗ chạm ngưỡng **tốc độ âm thanh** sớm nhất.

Khi **tip Mach number** tiến gần 1, xuất hiện sóng xung kích cục bộ, lực cản tăng vọt, hiệu suất cánh quạt rơi thẳng. Đây đúng là giới hạn mình đã nhắc ở bài động cơ phản lực: cánh quạt piston hay turboprop đều đụng bức tường này. Trong thực tế, turboprop hoạt động hiệu quả nhất ở khoảng **Mach 0.5 tới 0.6**, tức tầm 550 tới 650 km/h, và bắt đầu đuối khi vượt qua đó.

**Turbofan** né được cái bẫy này bằng một mẹo đơn giản: nhốt cái fan vào trong một vỏ (**nacelle**). Vỏ này làm chậm và định hướng dòng khí trước khi nó chạm cánh fan, nên fan có thể quay trong khi máy bay bay ở **Mach 0.8 tới 0.85** mà đầu cánh chưa bị hiệu ứng nén khí phá hoại. Cái giá phải trả là vỏ nacelle thêm trọng lượng và thêm lực cản bề mặt, thứ mà cánh quạt trần của turboprop không có.

# Ai thắng ở dải nào

Gộp lại, ta có một bức tranh khá gọn. Hãy nghĩ theo trục tốc độ hành trình:

| Dải tốc độ hành trình | Hiệu quả nhất | Lý do chính |
|---|---|---|
| Dưới ~550 km/h (Mach ~0.5) | **Turboprop** | Bypass hiệu dụng cực lớn, propulsive efficiency cao, không tốn vỏ nacelle |
| ~550 tới ~700 km/h | Vùng giao thoa | Turboprop bắt đầu chạm giới hạn tip Mach, turbofan bypass cao dần chiếm ưu thế |
| ~700 tới ~920 km/h (Mach ~0.8) | **Turbofan bypass cao** | Nhốt fan trong vỏ né được nén khí ở đầu cánh, vẫn giữ khối khí lớn |
| Trên Mach 1 | **Turbojet / turbofan bypass thấp** | Cần vận tốc khí xả rất cao, khối khí lớn chậm không còn tạo đủ lực |

Đây cũng giải thích vì sao các máy bay khu vực chặng ngắn như ATR 72 hay Dash 8 vẫn trung thành với turboprop: chúng bay chặng ngắn, tốc độ vừa, và mỗi lít nhiên liệu tiết kiệm được đều đáng giá. Trong khi đó máy bay thân hẹp đường dài như A320 hay 737 dùng turbofan bypass cao, chấp nhận thiệt một chút hiệu suất thuần túy để đổi lấy tốc độ hành trình cao hơn, nghĩa là bay được nhiều chuyến hơn và hành khách tới nơi nhanh hơn.

# Chỗ ranh giới đang mờ đi

Điều mình thấy thú vị là ngành động cơ đang cố xóa nhòa chính cái ranh giới mình vừa vẽ. Ý tưởng **open rotor** hay **propfan** về cơ bản là cố lấy **bypass ratio** khổng lồ của turboprop nhưng vẫn bay được ở tốc độ của turbofan, bằng cách thiết kế cánh quạt cong hình lưỡi mã (**swept blades**) để đẩy lùi giới hạn tip Mach. Những thiết kế này từng được thử nghiệm từ thập niên 1980 và gần đây được hồi sinh dưới sức ép tiết kiệm nhiên liệu.

Nhưng chúng vẫn chưa phổ biến, vì đổi lại là tiếng ồn lớn và bài toán tích hợp vào thân máy bay khá đau đầu. Đây là chỗ mình thấy khó đưa ra một kết luận sạch sẽ: về mặt vật lý thuần túy, đẩy nhiều khí chậm gần như luôn thắng, nhưng "gần như" đó bị chặn lại bởi tốc độ âm thanh, bởi trọng lượng vỏ, bởi tiếng ồn, và bởi cả thứ khó đo hơn là hành khách có chịu ngồi lâu hơn hay không.

Nên câu hỏi "turboprop hay turbofan hiệu quả hơn" thật ra là một câu hỏi thiếu vế. Hiệu quả ở tốc độ nào, cho chặng bay nào, và ta chịu đánh đổi cái gì. Cùng một nguyên lý vật lý, chỉ là ta chọn điểm làm việc khác nhau trên cùng một đường cong.

# Tài liệu tham khảo

- Rolls-Royce, *The Jet Engine* (ấn bản Wiley), chương về turbofan và bypass ratio.
- NASA Glenn Research Center, Beginner's Guide to Propulsion (propulsive efficiency, turboprop, turbofan).
- Wikipedia: "Turboprop", "Turbofan", "Bypass ratio", "Propulsive efficiency", "Propfan".
- Martin Hepperle, MH AeroTools, tài liệu thiết kế cánh quạt (giới hạn tip Mach và hệ số tiến J).

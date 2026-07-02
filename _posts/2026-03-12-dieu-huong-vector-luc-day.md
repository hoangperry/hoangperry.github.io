---
title: Điều hướng vector lực đẩy
excerpt: "Đi sâu vào vật lý của afterburner và điều hướng vector lực đẩy 2D trên động cơ phản lực."
permalink: /topics/dieu-huong-vector-luc-day/
categories:
  - topics
  - aviation
date: 2026-03-12 09:00
---

Trong bài về **động cơ phản lực** trước đây, chúng ta đã đi qua nhanh hai chi tiết nằm ở đuôi động cơ: **afterburner** (buồng đốt tăng lực) và **thrust vectoring** (điều hướng vector lực đẩy). Cả hai đều nằm ở phần "đuôi nóng" của động cơ, và cả hai đều là những nơi mà vật lý trở nên thú vị nhất. Bài này mình muốn quay lại, mở rộng và đi sâu hơn vào phần vật lý của chúng, đặc biệt là biến thể **2D vectoring**.

# Lực đẩy đến từ đâu?

Trước khi nói chuyện điều hướng, chúng ta cần thống nhất lực đẩy sinh ra như thế nào. Với một động cơ phản lực, lực đẩy **(N)** về cơ bản là tốc độ biến thiên động lượng của dòng khí đi qua động cơ. Công thức xấp xỉ quen thuộc là:

`F = ṁ · (Ve - V0) + (Pe - P0) · Ae`

Trong đó **ṁ** là lưu lượng khối lượng **(kg/s)**, **Ve** là vận tốc khí phụt ra ở miệng phun **(m/s)**, **V0** là vận tốc dòng khí đi vào (tức vận tốc máy bay), **Pe** là áp suất tĩnh tại miệng phun, **P0** là áp suất môi trường, và **Ae** là diện tích tiết diện miệng phun **(m²)**.

Số hạng thứ nhất `ṁ · (Ve - V0)` gọi là **momentum thrust**, số hạng thứ hai `(Pe - P0) · Ae` gọi là **pressure thrust**. Với động cơ dân dụng, người ta cố gắng thiết kế miệng phun sao cho `Pe ≈ P0`, tức dòng khí giãn nở đầy đủ (fully expanded) và pressure thrust gần bằng không. Điều quan trọng cần giữ trong đầu: muốn tăng lực đẩy, chúng ta chỉ có hai đòn bẩy thực sự, hoặc tăng **ṁ**, hoặc tăng **Ve**. Afterburner tấn công vào **Ve**.

# Afterburner: đốt lại phần khí còn thừa

Ở một động cơ turbine thông thường, hỗn hợp hòa khí được đốt trong buồng đốt chính với tỉ lệ nhiên liệu rất nghèo. Lý do không phải vì tiết kiệm, mà vì vật liệu. Cánh **turbine** ngay sau buồng đốt phải chịu dòng khí nóng liên tục, và giới hạn nhiệt của hợp kim cánh turbine (thường trong khoảng trên dưới 1500 đến 1700 K tùy công nghệ làm mát) đặt trần cho nhiệt độ trước turbine, gọi là **TIT** (Turbine Inlet Temperature). Vì phải giữ TIT dưới ngưỡng đó, buồng đốt chính chỉ dùng một phần nhỏ lượng oxi có trong dòng khí. Phần lớn oxi đi qua turbine mà chưa hề tham gia phản ứng cháy.

Đây chính là chỗ afterburner len vào. Sau khi dòng khí đã đi qua turbine (nơi không còn cánh nào để bảo vệ khỏi nhiệt nữa), người ta bơm thêm nhiên liệu vào và đốt lần thứ hai, tận dụng lượng oxi còn thừa. Vì không còn ràng buộc TIT, nhiệt độ trong ống afterburner có thể vọt lên rất cao, cỡ 1800 đến 2000 K.

Về mặt vật lý, việc đốt lại này nâng nhiệt độ tổng (stagnation temperature) của dòng khí. Vận tốc phụt ra ở miệng phun tỉ lệ với căn bậc hai của nhiệt độ tổng đó, xấp xỉ:

`Ve ≈ √(2 · cp · Tt · [1 - (P0/Pt)^((γ-1)/γ)])`

với **Tt** là nhiệt độ tổng **(K)**, **cp** là nhiệt dung riêng đẳng áp, và **γ** là tỉ số nhiệt dung (khoảng 1.3 đến 1.4 với khí cháy). Khi Tt tăng, **Ve** tăng theo, và momentum thrust tăng theo. Một afterburner có thể nâng lực đẩy thêm khoảng 40 đến 70 phần trăm so với chế độ khô (dry thrust).

Nhưng không có gì miễn phí. Vì hiệu suất đốt ở giai đoạn này thấp và lượng nhiên liệu bơm thêm rất lớn, mức tiêu hao nhiên liệu riêng (**TSFC**, thrust specific fuel consumption) tăng vọt, có thể gấp đôi hoặc hơn. Đó là lý do afterburner chỉ được bật trong vài phút: cất cánh, tăng tốc vượt âm, hoặc không chiến. Bật lâu thì bình xăng cạn rất nhanh.

Một chi tiết ít người để ý: khi bật afterburner, dòng khí nở ra nhiều hơn nên miệng phun phải mở rộng tiết diện **Ae** để tránh nghẹt dòng và giữ áp suất phù hợp. Đó là lý do các động cơ tiêm kích dùng miệng phun hội tụ-phân kỳ có thể thay đổi tiết diện (variable-geometry nozzle), với những lá thép xếp chồng mà ta thấy khép lại và xòe ra ở đuôi máy bay. Chi tiết cơ khí này sẽ dẫn thẳng chúng ta sang phần vectoring.

# 2D vectoring: bẻ cả dòng phụt

Nếu đằng nào miệng phun cũng đã là một cụm lá thép chuyển động được để điều tiết tiết diện, thì tại sao không dùng luôn chúng để bẻ hướng dòng phụt? Đó chính là ý tưởng của **thrust vectoring**.

Ở biến thể **2D** (hai chiều), người ta thay miệng phun tròn bằng một miệng phun chữ nhật, với hai lá trên và dưới có thể nghiêng đồng bộ lên hoặc xuống. Khi hai lá nghiêng, cả cột khí phụt bị bẻ đi một góc **δ** so với trục dọc động cơ. Vector lực đẩy giờ không còn nằm thẳng theo thân máy bay nữa, mà tách thành hai thành phần:

1. Thành phần dọc trục `F · cos(δ)` vẫn đẩy máy bay tiến tới.
2. Thành phần vuông góc `F · sin(δ)` tạo ra một lực nâng hoặc nhấn đuôi máy bay.

Điểm hay nằm ở đòn bẩy. Miệng phun nằm rất xa trọng tâm máy bay, nên thành phần `F · sin(δ)` nhân với cánh tay đòn đó tạo ra một **mô men lật** (pitching moment) rất lớn. Đây là mô men điều khiển trục pitch mà đuôi ngang (elevator) thông thường phải vất vả mới tạo ra được, đặc biệt ở góc tấn (**AoA**) lớn.

Và đó là chỗ vectoring thắng khí động học kinh điển. Ở góc tấn cao, khi máy bay gần thất tốc, dòng khí trên các mặt điều khiển đuôi tách ra (flow separation), elevator gần như mất tác dụng vì không còn dòng khí sạch chảy qua. Nhưng dòng phụt của động cơ thì không quan tâm đến chuyện đó: nó là dòng khí do chính động cơ tạo ra, luôn có động lượng, luôn bẻ được. Nhờ vậy máy bay trang bị vectoring có thể giữ điều khiển ở những góc tấn mà máy bay thường đã hoàn toàn mất lái, thực hiện được các động tác như **Pugachev's Cobra** hay **Herbst maneuver** (còn gọi là J-turn).

Vì sao chọn 2D thay vì bẻ mọi hướng? Có vài lý do thực tế. Miệng phun chữ nhật 2D dễ tích hợp với cấu trúc thân sau, và bản thân dạng dẹt của nó giúp trộn dòng khí nóng với không khí ngoài nhanh hơn, làm giảm bộc lộ hồng ngoại (**IR signature**), một lợi ích tàng hình rõ rệt. **F-22 Raptor** dùng đúng loại miệng phun 2D này, chỉ bẻ trong mặt phẳng dọc. Đổi lại, miệng phun chữ nhật nặng hơn và có tổn thất áp suất lớn hơn miệng phun tròn, nên nó ăn bớt một chút lực đẩy so với thiết kế tối ưu về khí động.

Biến thể còn lại là **axisymmetric vectoring**, dùng miệng phun tròn với vành lá thép nghiêng được theo mọi hướng, cho phép bẻ cả pitch lẫn yaw. Loại này nhẹ và ít tổn thất hơn (dòng **Sukhoi** với động cơ AL-31 và sau này AL-41 đi theo hướng này), nhưng cơ cấu điều khiển phức tạp và không cho lợi ích giảm IR như miệng phun dẹt.

# Khi hai thứ gặp nhau

Điều đáng nói là afterburner và vectoring không phải hai câu chuyện tách rời, chúng chia sẻ chung một cụm cơ khí ở đuôi động cơ. Cùng những lá thép variable-geometry đó vừa phải điều tiết tiết diện `Ae` theo trạng thái afterburner, vừa phải nghiêng để bẻ hướng dòng phụt. Bộ điều khiển động cơ (FADEC) phải phối hợp cả hai đồng thời: mở tiết diện đủ rộng cho dòng khí sau đốt lại, đồng thời giữ đúng góc bẻ mà phi công yêu cầu, tất cả trong khi dòng khí đang ở gần 2000 K. Đó là một bài toán điều khiển thời gian thực khá khắc nghiệt, và cũng là lý do các hệ thống này đắt đỏ, nặng, và chỉ xuất hiện trên tiêm kích cao cấp.

Có một câu hỏi mà mình vẫn thấy chưa có câu trả lời gọn: với sự trưởng thành của máy bay không người lái và điều khiển khí động thuần túy bằng bề mặt, liệu độ phức tạp cơ khí của vectoring có còn xứng đáng trong mọi trường hợp không? Trên một khung máy bay có người lái, khả năng giữ điều khiển ở góc tấn cực lớn là thứ cứu mạng trong không chiến tầm gần. Nhưng khi phần lớn giao chiến chuyển sang tầm xa bằng tên lửa, giá trị của việc bẻ được vài chục độ dòng phụt trở nên khó lượng hóa hơn. Mình nghĩ đây là một trong những chỗ mà kỹ thuật và học thuyết tác chiến kéo nhau, và câu trả lời sẽ còn thay đổi theo từng thế hệ máy bay.

# Tài liệu tham khảo

- Rolls-Royce, *The Jet Engine* (tài liệu kinh điển về nguyên lý động cơ turbine).
- NASA Glenn Research Center, Beginner's Guide to Propulsion (trang giải thích thrust equation và specific impulse).
- Wikipedia: "Afterburner", "Thrust vectoring", "Pugachev's Cobra".
- Mattingly, J. D., *Elements of Gas Turbine Propulsion* (McGraw-Hill).

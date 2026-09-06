---
title: "Liveness: chống giả mạo trong nhận diện khuôn mặt"
excerpt: "Nhận ra đúng một khuôn mặt mới là nửa bài toán, nửa còn lại là biết rằng khuôn mặt đó đang thật sự sống trước camera."
permalink: /topics/liveness-chong-gia-mao-khuon-mat/
categories:
  - topics
  - ai-ml
date: 2026-04-08 09:00
---


Khi nói về nhận diện khuôn mặt, đa số chúng ta hình dung ra bài toán "đây là ai". Nhưng có một bài toán đứng trước nó, âm thầm hơn, và thường là chỗ hệ thống bị đánh sập đầu tiên: "khuôn mặt trước camera có phải là một người thật đang sống hay không". Đó chính là **liveness detection**, hay còn gọi là **presentation attack detection (PAD)**. Bài viết này mình muốn đi qua ba mảnh ghép có liên quan chặt với nhau: **embedding**, cách chọn **ngưỡng (threshold)**, và cách phòng thủ trước **replay attack**.

*Nhận đúng người là một chuyện, chắc chắn rằng người đó đang thật sự ở đó lại là một chuyện khác.*

## Về lý thuyết, nhận diện khuôn mặt là gì

Một hệ thống nhận diện khuôn mặt hiện đại gần như luôn xoay quanh khái niệm **embedding**. Ý tưởng: đưa một ảnh khuôn mặt qua một mạng neural (thường là **CNN** hoặc gần đây là các kiến trúc **transformer**), rồi thu về một vector số thực có chiều cố định, ví dụ **128** hoặc **512** chiều. Vector này là **face embedding**, một điểm trong không gian nhiều chiều.

Điều làm cho embedding hữu ích là cách nó được huấn luyện. Với các hàm mất mát như **triplet loss** (nổi tiếng qua **FaceNet** của Google, 2015) hoặc họ **margin-based softmax** như **ArcFace** (2019), mạng học sao cho hai ảnh của cùng một người nằm gần nhau, còn hai người khác nhau nằm xa nhau. "Gần" và "xa" ở đây thường đo bằng **khoảng cách Euclid** hoặc **cosine similarity**.

Nói cách khác, việc so khớp khuôn mặt quy về so sánh hai vector. Với cosine similarity, ta tính:

`cos(a, b) = (a · b) / (‖a‖ · ‖b‖)`

Giá trị càng gần **1** thì hai khuôn mặt càng giống. Toàn bộ "trí thông minh" nằm ở mạng tạo embedding, còn khâu so khớp cuối cùng lại đơn giản đến bất ngờ. Đây là điểm đẹp và cũng là điểm nguy hiểm: nếu ai đó đưa vào một ảnh in hoặc một video phát lại mà mạng vẫn tạo ra embedding "đúng người", thì phần so khớp sẽ vui vẻ gật đầu.

## Chọn ngưỡng: nơi lý thuyết gặp thực tế

Giả sử ta đã có embedding của khuôn mặt đang đứng trước camera và embedding tham chiếu lưu trong cơ sở dữ liệu. Ta tính độ tương đồng, rồi phải quyết định: chấp nhận hay từ chối. Ranh giới đó là **ngưỡng**.

Chọn ngưỡng là một bài toán đánh đổi, không có con số đúng tuyệt đối. Có hai loại lỗi ngược nhau:

1. **False Acceptance Rate (FAR)**: tỉ lệ hệ thống chấp nhận nhầm người lạ thành người đúng. Đây là lỗi về **an ninh**.
2. **False Rejection Rate (FRR)**: tỉ lệ hệ thống từ chối nhầm chính chủ. Đây là lỗi về **trải nghiệm**.

Kéo ngưỡng khắt khe hơn (đòi similarity cao hơn) thì FAR giảm nhưng FRR tăng, người dùng thật bị làm phiền nhiều hơn. Nới lỏng ngưỡng thì ngược lại. Điểm mà FAR bằng FRR gọi là **Equal Error Rate (EER)**, một con số hay dùng để so sánh chất lượng giữa các mô hình, nhưng nó không nhất thiết là ngưỡng vận hành ta nên chọn.

Chọn ngưỡng thực tế phụ thuộc vào ngữ cảnh sử dụng. Mình hay nghĩ theo kiểu:

- Mở khóa điện thoại cá nhân: ưu tiên trải nghiệm, FRR thấp, người ta bực nếu máy không nhận mặt mình.
- Xác thực giao dịch ngân hàng hoặc kiểm soát ra vào khu vực nhạy cảm: ưu tiên an ninh, FAR phải cực thấp, chấp nhận đôi khi làm phiền chính chủ.

Một điểm dễ bị bỏ qua: ngưỡng học từ tập kiểm thử trong phòng lab thường lạc quan hơn thực tế. Ánh sáng, góc mặt, camera rẻ tiền, người đeo kính hay đội mũ, tất cả kéo phân bố similarity dịch đi. Vì thế ngưỡng nên được **hiệu chỉnh (calibrate)** trên dữ liệu gần giống môi trường triển khai, và nên được theo dõi lại theo thời gian. Đây là chỗ mà một con số nghe rất khoa học lại cần khá nhiều phán đoán kỹ thuật.

Và đây là điều quan trọng nhất của phần này: dù ngưỡng có được chỉnh tinh tế đến đâu, nó chỉ trả lời câu hỏi "có giống người đúng không". Nó **không** trả lời câu hỏi "đây có phải người thật không". Một tấm ảnh in sắc nét của bạn có thể tạo ra embedding gần như trùng khớp với chính bạn. Ngưỡng, tự thân nó, hoàn toàn mù trước giả mạo.

## Các kiểu tấn công trình diễn

Trước khi nói phòng thủ, cần điểm qua kẻ tấn công định làm gì. Trong thuật ngữ chuẩn (tham chiếu chuẩn **ISO/IEC 30107**), những cách này gọi chung là **presentation attack**:

- **Print attack**: in ảnh khuôn mặt nạn nhân ra giấy rồi giơ trước camera. Rẻ và đơn giản đến bất ngờ.
- **Replay attack**: phát lại một video hoặc ảnh khuôn mặt nạn nhân trên màn hình điện thoại, máy tính bảng. Vì là video nên có cả chuyển động, khó phân biệt hơn ảnh in.
- **3D mask attack**: dùng mặt nạ silicone hoặc in 3D. Tốn kém nhưng vượt được nhiều hệ thống chỉ dựa vào hình 2D.
- **Deepfake / injection attack**: tinh vi hơn, không giơ gì trước camera cả mà chèn thẳng luồng video giả vào đường truyền, bỏ qua camera vật lý. Đây là hướng tấn công đang lên và khó chịu nhất.

Trong nhóm này, replay attack đáng bàn nhất vì nó vừa rẻ, vừa mang chuyển động nên đánh lừa được các phòng thủ ngây thơ.

## Phòng thủ replay attack

Ý tưởng cốt lõi của mọi liveness detection là tìm bằng chứng cho thấy trước camera là một khuôn mặt sống ba chiều, chứ không phải một bề mặt phẳng phát lại. Có hai nhánh lớn.

### Liveness thụ động (passive)

Passive liveness cố phân biệt thật/giả chỉ từ hình ảnh, không yêu cầu người dùng làm gì. Nó bắt các dấu vết mà một màn hình hay tờ giấy để lại:

- **Moiré pattern**: khi chụp lại một màn hình, sự chồng lưới pixel của màn hình và cảm biến camera tạo ra hoa văn gợn sóng đặc trưng. Mắt người khó thấy nhưng mô hình học được.
- **Phản xạ và độ bóng**: màn hình phát ánh sáng và có vùng chói phẳng, da người phản xạ khác hẳn. Giấy in thì hay thấy nếp gấp, bóng đổ không tự nhiên.
- **Kết cấu da (texture)**: lỗ chân lông, vi mạch máu, độ nhám của da thật khác với bề mặt in hoặc màn hình. Nhiều mô hình PAD học chính đặc trưng tần số cao này.
- **Chiều sâu (depth)**: nếu có cảm biến depth (ví dụ camera hồng ngoại chấm như **Face ID** của Apple dùng **structured light**), một bề mặt phẳng lộ ra ngay vì không có hình học 3D của mặt thật.

Passive được ưa chuộng vì mượt, người dùng không phải làm gì thêm, nhưng nó chạy đua vũ trang với chất lượng màn hình và máy in ngày càng tốt.

### Liveness chủ động (active / challenge-response)

Active liveness yêu cầu người dùng phản ứng theo một thử thách ngẫu nhiên: chớp mắt, quay đầu sang trái, mỉm cười, đọc một dãy số. Cơ chế phòng thủ nằm ở tính **ngẫu nhiên và tức thời** của thử thách. Một video quay sẵn không thể biết trước hệ thống sẽ yêu cầu quay trái hay chớp mắt, nên không đáp ứng đúng và kịp lúc.

Đây cũng chính là điểm mấu chốt để chống replay: gắn mỗi phiên xác thực với một **thử thách chỉ dùng một lần (nonce)**, phát sinh phía máy chủ, có thời hạn ngắn. Cách nghĩ này rất giống chống replay trong bảo mật mạng nói chung, nơi ta đính nonce hoặc timestamp vào mỗi request để một gói tin cũ bị bắt lại không thể dùng lần hai.

Nói thêm về deepfake injection: khi kẻ tấn công chèn thẳng luồng video giả, ngay cả active liveness cũng có thể bị qua mặt nếu deepfake đủ nhanh để phản ứng với thử thách theo thời gian thực. Vì vậy các hệ thống nghiêm túc còn xác thực cả **tính toàn vẹn của đường dẫn thu ảnh**: chứng thực rằng khung hình thật sự đến từ camera phần cứng của thiết bị chứ không phải một luồng ảo được inject, thường qua các cơ chế attestation ở tầng hệ điều hành.

### Một khung phòng thủ nhiều lớp

Trong thực tế không ai chọn một biện pháp duy nhất. Một pipeline hợp lý thường chồng nhiều lớp:

1. **Detect và align** khuôn mặt trong khung hình.
2. **Passive liveness** chấm điểm nhanh dấu vết giả mạo (moiré, texture, depth).
3. **Active challenge** khi rủi ro cao hoặc điểm passive không đủ chắc.
4. **Sinh embedding** rồi so khớp với tham chiếu theo ngưỡng đã hiệu chỉnh.
5. **Ràng buộc phiên**: nonce, timestamp, và attestation nguồn ảnh để chống replay và injection.

Chỉ khi cả chuỗi này cùng gật đầu thì mới coi là xác thực thành công. Điểm hay của cách chồng lớp: kẻ tấn công phải vượt đồng thời nhiều rào có bản chất khác nhau, chi phí tấn công tăng phi tuyến.

## Vài đánh đổi thành thật

Không có hệ thống liveness nào hoàn hảo, và mình nghĩ điều lành mạnh là thừa nhận thẳng như vậy. Mỗi lớp phòng thủ đều kèm cái giá:

- Passive liveness mượt nhưng dễ tụt hiệu quả khi màn hình hoặc máy in đời mới hơn dữ liệu huấn luyện. Nó cần được cập nhật liên tục, giống một sản phẩm sống chứ không phải một mô hình đóng băng.
- Active liveness chắc hơn nhưng thêm ma sát, và người dùng lớn tuổi hoặc trong môi trường ồn ào có thể thao tác sai, đẩy FRR lên.
- Cảm biến depth chống 2D rất tốt nhưng cần phần cứng chuyên dụng, không phải camera web nào cũng có.
- Ngưỡng đặt càng chặt để giảm FAR thì càng làm phiền chính chủ, và ranh giới "đúng" thay đổi theo môi trường triển khai.

Cuối cùng, liveness không phải bài toán giải một lần rồi thôi. Nó là một cuộc rượt đuổi: kẻ tấn công tìm cách mới, người phòng thủ vá lại, rồi lặp. Điều thực tế nhất mà một kỹ sư có thể làm là đừng tin vào một lớp duy nhất, đo lường FAR và FRR trên dữ liệu gần với thực tế, và chấp nhận rằng con số "an toàn" hôm nay chỉ đúng cho tới lần tấn công thông minh kế tiếp. Mình thấy đó không phải một kết luận bi quan, chỉ là cách nhìn trung thực về một bài toán vẫn đang mở.

## Tài liệu tham khảo

- ISO/IEC 30107-1 và 30107-3, *Information technology, Biometric presentation attack detection*.
- Schroff, Kalenichenko, Philbin, *FaceNet: A Unified Embedding for Face Recognition and Clustering*, CVPR 2015.
- Deng, Guo, Xue, Zafeiriou, *ArcFace: Additive Angular Margin Loss for Deep Face Recognition*, CVPR 2019.
- NIST FRVT (Face Recognition Vendor Test), các báo cáo về FAR/FRR và presentation attack, trang chính thức của NIST.
- Apple Platform Security Guide, phần Face ID và TrueDepth camera.
- Wikipedia, các mục *Liveness detection*, *Spoofing attack*, *Cosine similarity*.

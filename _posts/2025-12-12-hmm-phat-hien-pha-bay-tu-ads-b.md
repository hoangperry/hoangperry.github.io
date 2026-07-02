---
title: HMM phát hiện pha bay từ dữ liệu ADS-B
excerpt: "Suy luận taxi, climb, cruise, descent từ một vệt ADS-B thô bằng Hidden Markov Model và thuật toán Viterbi."
permalink: /topics/hmm-phat-hien-pha-bay-tu-ads-b/
categories:
  - topics
  - ai-ml
date: 2025-12-12 09:00
---

Mình thích những bài toán mà một mẩu dữ liệu tưởng như vô hồn lại kể được cả một câu chuyện. Một vệt **ADS-B** là như vậy: chỉ là chuỗi các điểm (vĩ độ, kinh độ, độ cao, vận tốc) rơi về đều đặn mỗi giây, nhưng nếu nhìn đúng cách, chúng ta đọc ra được cả hành trình của một chuyến bay: xe kéo ra khỏi bến, taxi trên đường lăn, tăng tốc cất cánh, leo cao, bay bằng, hạ độ cao rồi tiếp đất. Bài này nói về cách gán nhãn **pha bay (flight phase)** cho từng điểm trong vệt đó, bằng một mô hình rất cổ điển của học máy: **Hidden Markov Model (HMM)**, giải bằng thuật toán **Viterbi**.

# ADS-B là gì?

**ADS-B** viết tắt của **Automatic Dependent Surveillance-Broadcast**. Về lý thuyết, đây là một cơ chế giám sát trong đó máy bay tự xác định vị trí của mình (thường qua **GNSS**, tức là GPS và các hệ tương đương) rồi tự động phát quảng bá thông tin đó ra không trung, không cần radar mặt đất hỏi trước. Chữ *dependent* nằm ở chỗ nó phụ thuộc vào hệ định vị trên máy bay, khác với radar sơ cấp vốn tự dội sóng và đo phản hồi.

Bản tin ADS-B phổ biến nhất phát ở tần số **1090 MHz** dưới dạng **Extended Squitter (1090ES)**. Mỗi bản tin gói vài trường: định danh máy bay (**ICAO 24-bit address**), vị trí ngang, độ cao khí áp **(ft)**, vận tốc mặt đất **(kt)**, tốc độ leo hay hạ **(ft/min)**. Với người chơi dữ liệu, điều đáng yêu là bất kỳ ai có một chiếc thu **SDR** rẻ tiền và phần mềm như **dump1090** đều bắt được, và các mạng cộng đồng như **OpenSky Network** còn công khai kho dữ liệu lịch sử để nghịch.

Vấn đề: bản tin ADS-B *không* nói cho chúng ta biết máy bay đang ở pha nào. Nó chỉ nói độ cao và vận tốc. Việc suy ra "đây là lúc đang leo cao" hay "đây là lúc taxi" là việc của chúng ta.

# Tại sao không chỉ dùng ngưỡng?

Cách đơn giản nhất, và cũng là cách đầu tiên ai cũng thử, là đặt luật cứng bằng ngưỡng **(threshold)**:

1. Nếu độ cao gần bằng sân bay và vận tốc dưới 30 kt thì gọi là taxi.
2. Nếu tốc độ leo dương lớn thì gọi là climb.
3. Nếu tốc độ leo gần 0 và độ cao lớn thì gọi là cruise.
4. Nếu tốc độ leo âm thì gọi là descent.

Cách này chạy được, nhưng nó giòn. Dữ liệu ADS-B thực tế đầy nhiễu: một điểm GPS nhảy, một giá trị `vertical rate` bị lỗi, một khoảng vài giây mất tín hiệu. Chỉ cần một mẫu tốc độ leo đọc nhầm thành âm giữa lúc đang bay bằng, luật ngưỡng sẽ nhấp nháy "cruise, descent, cruise, descent" như đèn nháy. Máy bay thật thì không cư xử như thế: nó ở trong một pha một lúc lâu rồi mới chuyển sang pha kế tiếp, và không phải pha nào cũng nối được với pha nào (không ai đang taxi mà nhảy phắt sang cruise).

Đây chính xác là chỗ HMM tỏa sáng. Thay vì quyết định từng điểm một cách độc lập, HMM đưa vào hai loại kiến thức: **quan sát nhiễu** và **ràng buộc thời gian**. Nó tìm chuỗi pha *mượt và hợp lý nhất* trên toàn bộ vệt bay, chứ không giật cục theo từng mẫu.

# Hidden Markov Model, nói cho gọn

Một **HMM** mô tả một hệ diễn tiến qua các **trạng thái ẩn (hidden states)** mà chúng ta không quan sát trực tiếp. Ở mỗi bước thời gian, hệ đang ở một trạng thái, và nó phát ra một **quan sát (observation)** mà chúng ta *đo được*. Cái tên "ẩn" nằm ở chỗ: chúng ta thấy quan sát, nhưng phải suy ngược ra trạng thái.

Trong bài toán của chúng ta:

- **Trạng thái ẩn** là pha bay: `taxi`, `climb`, `cruise`, `descent`, `ground` (và có thể tách thêm `takeoff`, `approach` nếu muốn mịn hơn).
- **Quan sát** là các đại lượng đo được từ ADS-B: độ cao, vận tốc mặt đất, tốc độ leo.

Một HMM rời rạc được định nghĩa bởi ba nhóm tham số, thường ký hiệu chung là **λ = (A, B, π)**:

1. **Ma trận chuyển trạng thái A**: `A[i][j]` là xác suất từ pha `i` chuyển sang pha `j` ở bước kế tiếp. Đây là chỗ mã hóa "vật lý của chuyến bay": xác suất `cruise -> cruise` phải rất cao (máy bay bay bằng hàng chục phút), xác suất `taxi -> cruise` phải bằng 0.
2. **Mô hình phát xạ B**: xác suất quan sát được dữ liệu đo, cho trước một pha. Ví dụ pha `climb` sinh ra tốc độ leo dương lớn với xác suất cao.
3. **Phân phối khởi đầu π**: `π[i]` là xác suất vệt bắt đầu ở pha `i`. Thường một vệt hoàn chỉnh bắt đầu ở `ground` hoặc `taxi`.

Giả định cốt lõi của Markov là **tính không nhớ (memoryless)**: trạng thái kế tiếp chỉ phụ thuộc trạng thái hiện tại, không phụ thuộc toàn bộ quá khứ. Đây là một giả định đơn giản hóa, không hoàn toàn đúng với chuyến bay thật (thời gian đã ở trong một pha *có* ảnh hưởng), nhưng nó đủ tốt và làm bài toán giải được nhanh.

# Mô hình phát xạ: rời rạc hay liên tục?

Có hai đường đi. Đường thứ nhất là **rời rạc hóa (discretize)** quan sát: chia tốc độ leo thành vài khoảng (`giảm mạnh`, `giảm nhẹ`, `bằng phẳng`, `tăng nhẹ`, `tăng mạnh`), chia độ cao và vận tốc tương tự, rồi mỗi điểm ADS-B trở thành một ký hiệu rời rạc. Khi đó `B` chỉ là một bảng xác suất. Cách này dễ hiểu, dễ debug, và mình khuyên nên bắt đầu từ đây.

Đường thứ hai là dùng **phát xạ liên tục**, thường là **Gaussian** hoặc **Gaussian Mixture** trên vector quan sát. Khi đó mỗi pha được mô tả bằng một phân phối chuẩn nhiều chiều: `climb` có trung bình tốc độ leo khoảng +2000 ft/min, `cruise` có trung bình quanh 0 với phương sai nhỏ. Cách này mượt hơn, tránh việc phải chọn ranh giới khoảng một cách tùy tiện, nhưng cần cẩn thận chuẩn hóa **(normalize)** các đặc trưng vì độ cao (đơn vị nghìn ft) và tốc độ leo (đơn vị nghìn ft/min) có thang rất khác nhau.

Một mẹo nhỏ trong thực tế: đừng đưa độ cao *tuyệt đối* vào phát xạ một cách ngây thơ, vì sân bay ở các độ cao khác nhau. Nên dùng độ cao *so với sân bay khởi hành hoặc đích*, hoặc tốt hơn là để các đặc trưng động (tốc độ leo, gia tốc) gánh phần lớn công việc phân biệt pha.

# Viterbi: tìm con đường tốt nhất

Có mô hình rồi, câu hỏi là: cho trước vệt quan sát, chuỗi pha *khả dĩ nhất* là gì? Đây là bài toán **decoding**, và lời giải kinh điển là thuật toán **Viterbi**, một dạng quy hoạch động **(dynamic programming)**.

Ý tưởng cốt lõi rất đẹp. Tại mỗi bước thời gian `t` và mỗi pha `j`, chúng ta lưu **xác suất của con đường tốt nhất** kết thúc tại pha `j` ở thời điểm `t`. Gọi nó là `δ[t][j]`. Quan hệ truy hồi:

```
δ[t][j] = ( max_i  δ[t-1][i] * A[i][j] ) * B[j](o_t)
```

Nghĩa là: đường tốt nhất tới `j` ở bước `t` bằng đường tốt nhất tới một pha `i` nào đó ở bước `t-1`, nhân xác suất chuyển `i -> j`, nhân xác suất pha `j` phát ra quan sát `o_t`. Ta lưu lại `i` đạt cực đại đó vào một mảng con trỏ ngược **(backpointer)**. Sau khi quét hết vệt, ta chọn pha cuối có `δ` lớn nhất rồi lần theo con trỏ ngược về đầu để dựng lại toàn bộ chuỗi pha.

Một lưu ý kỹ thuật bắt buộc: các xác suất nhân nhau hàng nghìn lần sẽ tụt về 0 do sai số dấu phẩy động, gọi là **underflow**. Cách chuẩn là làm việc trong **miền log**: nhân thành cộng, `max` vẫn là `max`.

```
δ_log[t][j] = ( max_i  δ_log[t-1][i] + log A[i][j] ) + log B[j](o_t)
```

Độ phức tạp là `O(T * N^2)` với `T` là số điểm trong vệt và `N` là số pha. Với `N` chỉ khoảng 5 và `T` vài nghìn, việc này chạy trong mili giây. Đây là điểm cộng lớn: rẻ, xác định **(deterministic)**, và dễ đưa lên pipeline xử lý hàng loạt.

# Một khung xử lý thực tế

Gộp lại, một pipeline gán pha bay từ ADS-B thô thường gồm các bước sau:

1. **Thu và gom vệt**: nhóm bản tin theo `ICAO address` và theo cửa sổ thời gian, sắp xếp theo timestamp.
2. **Làm sạch**: bỏ điểm trùng, bỏ điểm nhảy vị trí phi lý, nội suy các khoảng mất tín hiệu ngắn. Tính lại tốc độ leo từ chênh lệch độ cao nếu trường `vertical rate` không đáng tin.
3. **Trích đặc trưng**: độ cao chuẩn hóa, vận tốc mặt đất, tốc độ leo, và có thể thêm gia tốc.
4. **Chọn khoảng lấy mẫu đều**: ADS-B tới không hoàn toàn đều, nên thường resample về lưới thời gian cố định (ví dụ mỗi 5 giây) để giả định Markov nhất quán hơn.
5. **Decode bằng Viterbi**: chạy trên toàn vệt để ra chuỗi pha.
6. **Hậu xử lý nhẹ**: gộp các đoạn pha quá ngắn, kiểm tra ràng buộc logic (một pha `ground` xen giữa hai `cruise` là dấu hiệu lỗi).

Về việc *chọn tham số*, có hai con đường. Con đường thủ công: đặt `A`, `B`, `π` bằng tay dựa trên hiểu biết hàng không (mình thấy cách này bất ngờ hiệu quả và rất dễ giải thích). Con đường học: nếu có dữ liệu gán nhãn, ước lượng tham số bằng đếm tần suất; nếu không có nhãn, dùng **Baum-Welch** (một dạng **EM**) để học không giám sát. Baum-Welch mạnh nhưng dễ rơi vào cực trị cục bộ và cho ra các pha khó diễn giải, nên nếu mục tiêu là một hệ minh bạch, khởi tạo tốt bằng tay rồi tinh chỉnh vẫn thường thắng.

# Những chỗ mô hình sẽ vấp

Thành thật mà nói, HMM không phải viên đạn bạc. Vài chỗ cần lường trước:

- **Ranh giới pha mờ**: thời điểm chuyển từ `climb` sang `cruise` không phải một điểm sắc nét mà là một dải. Nhãn của mô hình ở vùng này sẽ hơi tùy tiện, và đó là chuyện bình thường.
- **Giả định memoryless không khớp thời lượng**: HMM cơ bản mã hóa thời lượng ở một pha bằng phân phối hình học, vốn thiên về các đoạn ngắn. Nếu thời lượng pha quan trọng, một **Hidden Semi-Markov Model (HSMM)** mô hình hóa thời lượng tường minh sẽ hợp hơn, đổi lại tốn kém hơn.
- **Pha step-climb**: máy bay đường dài thường leo bậc thang giữa hành trình. Nếu mô hình chỉ có một pha `cruise`, những đoạn leo ngắn này sẽ gây nhiễu, cần hoặc thêm pha, hoặc nới lỏng phát xạ của `cruise`.
- **Dữ liệu thiếu**: mất tín hiệu dài làm đứt giả định liên tục thời gian. Cần quyết định rõ: nội suy, hay cắt vệt thành nhiều đoạn.

Điều mình thích ở hướng tiếp cận này là nó nằm đúng giao điểm giữa hai thế giới mình quan tâm: một mô hình xác suất kinh điển của học máy, đặt lên một dòng dữ liệu rất vật lý của ngành hàng không. Nó không cần mạng nơ-ron, không cần GPU, chạy được trên một máy tính xách tay, mà vẫn cho ra kết quả có thể giải thích từng bước. Với mình, đó là kiểu công cụ đáng tin: khi nó sai, chúng ta biết vì sao nó sai. Và trong nhiều bài toán thực tế, một mô hình mà chúng ta hiểu tường tận vẫn quý hơn một mô hình mạnh nhưng khó đọc.

# Tài liệu tham khảo

- Lawrence R. Rabiner, "A Tutorial on Hidden Markov Models and Selected Applications in Speech Recognition", Proceedings of the IEEE, 1989. (Bài tổng quan kinh điển về HMM, Viterbi, và Baum-Welch.)
- Andrew J. Viterbi, "Error Bounds for Convolutional Codes and an Asymptotically Optimum Decoding Algorithm", IEEE Transactions on Information Theory, 1967.
- The OpenSky Network, tài liệu và bộ dữ liệu ADS-B công khai (opensky-network.org).
- Junzi Sun, "The 1090 Megahertz Riddle: A Guide to Decoding Mode S and ADS-B Signals" (mô tả chi tiết cấu trúc bản tin ADS-B, bản mở tại mode-s.org).
- ICAO Annex 10, Aeronautical Telecommunications, phần về surveillance và ADS-B.
- Wikipedia: "Automatic Dependent Surveillance-Broadcast", "Hidden Markov model", "Viterbi algorithm".

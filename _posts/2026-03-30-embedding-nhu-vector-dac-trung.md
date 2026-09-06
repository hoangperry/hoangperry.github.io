---
title: Embedding như vector đặc trưng
excerpt: "Vì sao lựa chọn cosine hay Euclid mới là chuyện đáng bàn khi làm việc với vector đặc trưng."
permalink: /topics/embedding-nhu-vector-dac-trung/
categories:
  - topics
  - ai-ml
date: 2026-03-30 09:00
---


## Embedding là gì?

Về lý thuyết, **embedding** là cách chúng ta biểu diễn một đối tượng bất kỳ (một từ, một câu, một tấm ảnh, một sản phẩm) bằng một danh sách các con số. Danh sách đó chính là một **vector** trong một không gian nhiều chiều. Nếu một câu được biểu diễn bằng 768 con số, thì ta nói câu đó nằm trong không gian **768 chiều**, mỗi con số là một toạ độ theo một trục.

Điểm mấu chốt để hiểu đúng embedding là ở chữ **đặc trưng (feature)**. Mỗi chiều của vector, về nguyên tắc, mã hoá một khía cạnh nào đó của đối tượng. Chúng ta không đọc được từng chiều một cách rõ ràng như "chiều thứ 40 nghĩa là mức độ trang trọng", nhưng toàn bộ vector gộp lại tạo ra một tấm căn cước số học, và những đối tượng "giống nhau về mặt ngữ nghĩa" thì nằm gần nhau trong không gian đó.

*Embedding không phải là dữ liệu gốc. Nó là một cách nén ý nghĩa của dữ liệu gốc thành toạ độ.*

## Từ vector đặc trưng thủ công tới vector học được

Ý tưởng biểu diễn một vật bằng vector đặc trưng có trước học sâu rất lâu. Trong xử lý ảnh cổ điển, người ta tự tay thiết kế các **feature** như histogram màu, cạnh, góc (kiểu **SIFT**, **HOG**). Trong xử lý văn bản, mô hình **bag-of-words** hay **TF-IDF** biểu diễn một văn bản bằng vector đếm từ, mỗi chiều ứng với một từ trong từ điển. Những vector này thường rất dài và **thưa (sparse)**: hầu hết các chiều bằng 0.

Bước ngoặt là khi chúng ta chuyển từ vector đặc trưng do con người thiết kế sang vector đặc trưng do mô hình tự học. **Word2Vec** (Mikolov và cộng sự, 2013) là ví dụ kinh điển: thay vì gán mỗi từ một chiều riêng, mô hình học một vector **dày (dense)** vài trăm chiều cho mỗi từ, dựa trên nguyên tắc "một từ được định nghĩa bởi những từ đứng cạnh nó". Kết quả nổi tiếng là các quan hệ dạng số học vector, ví dụ `vua - đàn ông + đàn bà ≈ nữ hoàng`. Đây chính là lúc từ "đặc trưng" và từ "vector" hoà làm một: embedding là vector đặc trưng, nhưng là đặc trưng được học ra thay vì được viết tay.

Ngày nay các mô hình như **BERT**, **Sentence-Transformers**, hay các mô hình embedding thương mại đều xuất ra vector dày cho câu và đoạn văn. Chiều phổ biến rơi vào khoảng vài trăm tới vài nghìn, ví dụ 384, 768, hay 1536.

## Đo "giống nhau" như thế nào?

Có embedding rồi thì câu hỏi thực sự đáng bàn mới xuất hiện: hai vector giống nhau tới mức nào? Đây không phải câu hỏi phụ. Toàn bộ các ứng dụng như tìm kiếm ngữ nghĩa, gợi ý sản phẩm, hay khâu truy hồi trong **RAG** đều đứng trên một phép đo khoảng cách. Chọn sai phép đo thì kết quả lệch, dù embedding có tốt tới đâu.

Hai lựa chọn phổ biến nhất là **khoảng cách Euclid** và **độ tương đồng cosine**.

### Khoảng cách Euclid

Đây là khoảng cách "thước dây" quen thuộc. Với hai vector `a` và `b`, khoảng cách Euclid là

```
d(a, b) = sqrt( sum_i (a_i - b_i)^2 )
```

Nó đo độ dài đường thẳng nối hai điểm trong không gian. Euclid nhạy với cả **hướng** lẫn **độ lớn (magnitude)** của vector. Hai vector chỉ về cùng một phía nhưng một cái dài, một cái ngắn thì vẫn bị coi là cách xa nhau.

### Độ tương đồng cosine

Cosine bỏ qua độ dài, chỉ quan tâm tới **góc** giữa hai vector:

```
cos(a, b) = (a · b) / (||a|| * ||b||)
```

Trong đó `a · b` là tích vô hướng, còn `||a||` là độ dài (chuẩn) của vector. Giá trị nằm trong khoảng từ -1 tới 1: bằng 1 là cùng hướng hoàn toàn, bằng 0 là vuông góc, bằng -1 là ngược hướng. Người ta hay dùng **khoảng cách cosine** `1 - cos(a, b)` để biến nó thành một đại lượng "càng nhỏ càng gần".

## Vì sao lựa chọn cosine hay Euclid mới là chuyện đáng bàn

Nhiều người mặc định dùng cosine cho văn bản mà không hỏi tại sao. Để hiểu lựa chọn này cho tử tế, chúng ta cần nhìn vào một chi tiết: mối liên hệ giữa hai phép đo phụ thuộc rất nhiều vào việc vector đã được **chuẩn hoá (normalize)** hay chưa.

Nếu mọi vector đều được chuẩn hoá về độ dài bằng 1 (đưa lên mặt cầu đơn vị), thì Euclid và cosine tương đương nhau về mặt thứ hạng. Cụ thể, với hai vector đơn vị,

```
d(a, b)^2 = 2 * (1 - cos(a, b))
```

Nghĩa là sắp xếp theo Euclid hay theo cosine cho ra cùng một thứ tự láng giềng. Lúc này tranh cãi "cosine hay Euclid" trở nên vô nghĩa, và điều thực sự quan trọng chỉ còn là: bạn có chuẩn hoá hay không.

Khác biệt lộ ra khi vector **không** được chuẩn hoá, tức là độ lớn của vector mang ý nghĩa. Đây là chỗ đáng bàn thật sự:

1. **Khi độ lớn là nhiễu.** Trong nhiều mô hình embedding văn bản, độ dài vector tương quan với những thứ ta không muốn quan tâm, ví dụ độ dài văn bản hay tần suất từ. Một tài liệu dài có thể tạo ra vector "lớn" hơn đơn thuần vì nó dài, chứ không phải vì nó liên quan hơn. Trong trường hợp này cosine là lựa chọn đúng, vì nó vứt bỏ độ lớn và chỉ giữ lại hướng, tức là giữ lại chủ đề.

2. **Khi độ lớn là tín hiệu.** Có những không gian đặc trưng mà độ lớn mang thông tin thật. Ví dụ vector đếm, vector cường độ, hay các đặc trưng vật lý mà "nhiều hơn" thực sự khác "ít hơn". Ở đây, chuẩn hoá đi độ lớn là vứt mất dữ liệu, và Euclid (hoặc tích vô hướng thô) mới phản ánh đúng khoảng cách.

3. **Tích vô hướng (dot product) như con đường thứ ba.** Nhiều hệ thống truy hồi thực chất tối ưu theo **inner product** chứ không phải cosine hay Euclid. Tích vô hướng vừa nhạy với hướng vừa nhạy với độ lớn, nên nó hữu ích khi ta muốn vector "vừa đúng chủ đề vừa mạnh" được ưu tiên, ví dụ khi độ lớn được huấn luyện để mã hoá độ phổ biến hay độ tự tin. Điều đáng lưu ý: nếu vector đã chuẩn hoá thì tích vô hướng chính là cosine.

Vậy nên câu hỏi không phải "cosine tốt hơn hay Euclid tốt hơn" một cách trừu tượng. Câu hỏi đúng là: **trong không gian đặc trưng cụ thể của tôi, độ lớn của vector là tín hiệu hay là nhiễu?** Trả lời được câu đó thì lựa chọn phép đo gần như tự hiện ra.

### Một vài lưu ý thực hành

- Hãy kiểm tra xem mô hình embedding bạn dùng có khuyến nghị phép đo nào không. Rất nhiều mô hình câu được huấn luyện với mục tiêu cosine, nên dùng cosine (hoặc chuẩn hoá rồi dùng tích vô hướng) là hợp lý nhất, còn dùng Euclid trên vector chưa chuẩn hoá có thể cho thứ hạng lệch.
- Nếu bạn dùng cơ sở dữ liệu vector như **FAISS**, **pgvector**, hay tương tự, hãy để ý loại chỉ mục và **metric** bạn khai báo phải khớp với cách vector được sinh ra. Một lỗi âm thầm hay gặp là dựng chỉ mục theo L2 (Euclid) trong khi mô hình lại được thiết kế cho cosine.
- Chuẩn hoá là một thao tác rẻ và thường an toàn cho văn bản: đưa mọi vector về độ dài 1, rồi cosine và Euclid trở nên tương đương, và tích vô hướng cũng vậy. Chỉ đừng chuẩn hoá một cách máy móc khi độ lớn thật sự mang thông tin.

## Một chút về "lời nguyền chiều cao"

Còn một lý do sâu hơn khiến việc chọn phép đo trở nên tinh tế: khi số chiều tăng lên vài trăm hay vài nghìn, trực giác hình học của chúng ta ở không gian hai, ba chiều gần như sụp đổ. Hiện tượng này thường được gọi là **lời nguyền chiều cao (curse of dimensionality)**. Trong không gian rất nhiều chiều, khoảng cách giữa điểm gần nhất và điểm xa nhất có xu hướng co lại gần nhau, khiến khái niệm "láng giềng gần nhất" trở nên kém sắc nét hơn ta tưởng.

Điều này không có nghĩa là embedding vô dụng, thực tế chúng hoạt động rất tốt, nhưng nó nhắc chúng ta rằng khoảng cách trong không gian đặc trưng là một đại lượng cần được đối xử cẩn thận, không phải một con số hiển nhiên. Cosine thường tỏ ra bền hơn Euclid trong bối cảnh nhiều chiều vì nó chuẩn hoá đi một bậc tự do (độ lớn), giảm bớt một nguồn biến động. Đây là một trong những lý do thực dụng khiến cosine phổ biến trong tìm kiếm văn bản, dù không có định luật nào bắt buộc phải như vậy.

## Tạm kết

Chúng ta hay coi embedding là phần thú vị và coi phép đo khoảng cách là chi tiết kỹ thuật buồn tẻ ở cuối. Mình nghĩ ngược lại. Sinh ra embedding tốt là việc của mô hình, và phần lớn thời gian chúng ta chỉ gọi một mô hình có sẵn. Còn quyết định đo "giống nhau" như thế nào, chuẩn hoá hay không, độ lớn là tín hiệu hay nhiễu, lại là việc của người xây hệ thống, và nó ảnh hưởng trực tiếp tới chất lượng kết quả mà người dùng cảm nhận được.

Thành thật mà nói, không có câu trả lời phổ quát. Có những tập dữ liệu mà cả cosine lẫn Euclid cho kết quả gần như nhau, và có những tập mà đổi phép đo làm thứ hạng xáo trộn hẳn. Cách lành mạnh nhất, như thường lệ, là thử cả hai trên một tập đánh giá của chính bạn và đo bằng một chỉ số truy hồi cụ thể, thay vì tin vào một lựa chọn mặc định. Embedding cho ta toạ độ, còn phép đo mới cho ta ý nghĩa của khoảng cách giữa các toạ độ đó.

## Tài liệu tham khảo

- Mikolov et al., "Efficient Estimation of Word Representations in Vector Space" (Word2Vec), 2013.
- Devlin et al., "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding", 2019.
- Reimers & Gurevych, "Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks", 2019.
- Wikipedia: "Cosine similarity", "Euclidean distance", "Curse of dimensionality".
- Tài liệu FAISS (facebookresearch/faiss) và pgvector về các metric L2, inner product và cosine.

---
title: Tìm ảnh ngược để nhận dạng máy bay
excerpt: "Ghép thị giác máy tính với đam mê hàng không: dùng embedding ảnh và Milvus để đoán một chiếc máy bay lạ thuộc loại nào."
permalink: /topics/tim-anh-nguoc-nhan-dang-may-bay/
categories:
  - topics
  - ai-ml
date: 2025-12-21 09:00
---


Mình có hai sở thích cứ va vào nhau: ngắm máy bay và nghịch mấy mô hình thị giác máy tính. Bài này là chỗ hai thứ đó gặp nhau. Câu hỏi rất đơn giản: chụp được một chiếc máy bay lạ ngoài sân bay, làm sao để máy tính đoán giúp mình nó là loại gì? Đây không phải bài toán phân loại theo kiểu "huấn luyện một mạng nhận đúng 300 loại máy bay", mà là bài toán **tìm ảnh ngược** (reverse image search): mình có sẵn một kho ảnh đã dán nhãn, và mình muốn tìm những ảnh giống chiếc trong tay mình nhất, rồi để nhãn của chúng "bỏ phiếu".

*Ý tưởng cốt lõi: đừng bắt mô hình trả lời trực tiếp, hãy bắt nó so sánh.*

# Về lý thuyết, tìm ảnh ngược là gì?

**Reverse image search** là bài toán: cho một ảnh truy vấn, tìm trong một tập ảnh lớn những ảnh gần giống nó nhất về mặt nội dung. Điểm mấu chốt là chữ "gần giống". Máy tính không hiểu "chiếc **Boeing 737** này giống chiếc kia" theo kiểu con người. Nó cần một cách biến mỗi ảnh thành một dãy số, rồi định nghĩa "giống nhau" bằng khoảng cách giữa các dãy số đó.

Dãy số ấy gọi là **embedding**, hay vector đặc trưng. Một mô hình thị giác tốt sẽ ánh xạ mỗi ảnh thành một điểm trong một không gian nhiều chiều (thường 512, 768 hay 1024 chiều), sao cho hai ảnh có nội dung tương tự thì hai điểm nằm gần nhau. Khi đó "tìm ảnh giống nhất" trở thành "tìm điểm gần nhất", tức bài toán **k-nearest neighbors** trên vector.

So với hướng phân loại truyền thống, cách này có một ưu điểm rất hợp với thú chơi máy bay: thêm một loại mới không cần huấn luyện lại gì cả. Muốn hệ thống biết thêm chiếc **Airbus A350**? Chỉ cần thả vài chục ảnh A350 đã dán nhãn vào kho là xong. Với một lĩnh vực mà biến thể nhiều vô kể (cùng một dòng 737 đã có 737-700, -800, -900, MAX, rồi lại còn sơn màu của từng hãng), khả năng mở rộng kiểu này quý hơn nhiều so với một mô hình phân loại cứng nhắc.

# Embedding ảnh đến từ đâu?

Phần "biến ảnh thành vector" là nơi mấy năm gần đây tiến bộ nhanh nhất. Có vài lựa chọn quen thuộc:

1. **Mạng CNN huấn luyện sẵn trên ImageNet**, ví dụ **ResNet-50**. Cách kinh điển: bỏ lớp phân loại cuối cùng, lấy vector trước đó (thường 2048 chiều) làm embedding. Đơn giản, chạy nhanh, nhưng vector này được tối ưu cho việc phân loại 1000 lớp của ImageNet chứ không hẳn cho việc so sánh máy bay với nhau.
2. **Mô hình học tương phản** như **CLIP** của OpenAI. CLIP được huấn luyện trên hàng trăm triệu cặp ảnh và mô tả văn bản, nên embedding của nó nắm ngữ nghĩa khá tốt và tổng quát. Đây là lựa chọn mình hay dùng nhất cho việc nghịch, vì chỉ cần vài dòng là có vector.
3. **Mô hình tự giám sát** như **DINOv2** của Meta. Nhóm này học đặc trưng thị giác thuần túy mà không cần nhãn, và cho ra embedding rất mạnh cho các tác vụ so khớp ảnh, nhất là khi cần phân biệt chi tiết tinh vi.

Điều cần nhớ: embedding chỉ tốt trong phạm vi thứ nó từng thấy. Một mô hình tổng quát sẽ nắm được "đây là máy bay chở khách hai động cơ, cánh gắn dưới thân", nhưng phân biệt **A320** với **737** thì khó hơn nhiều, vì khác biệt nằm ở những chi tiết nhỏ: hình dáng chóp mũi, cửa hút gió động cơ, phần đuôi cánh (winglet hay sharklet). Nếu muốn nghiêm túc, bước tinh chỉnh (fine-tune) trên tập ảnh máy bay của riêng mình gần như là bắt buộc. Mình sẽ nói kỹ hơn ở phần trade-off.

# Lắp mọi thứ lại với Milvus

Có vector rồi thì cần một chỗ để cất và tìm cho nhanh. Với vài nghìn ảnh, một mảng numpy và phép nhân ma trận là đủ. Nhưng khi kho ảnh lên tới hàng trăm nghìn hay hàng triệu, so từng cặp một (brute force) trở nên chậm, và ta cần một **vector database** với **chỉ mục xấp xỉ** (approximate nearest neighbor). Mình dùng **Milvus** vì đã quen, nó chạy gọn trong **Docker** và hỗ trợ **HNSW** ngay.

Quy trình gồm hai giai đoạn rõ rệt. Giai đoạn nạp (offline): duyệt qua kho ảnh đã dán nhãn, tính embedding cho từng ảnh, lưu vector kèm nhãn loại máy bay vào collection. Giai đoạn truy vấn (online): nhận ảnh mới, tính embedding, hỏi Milvus lấy `k` láng giềng gần nhất, rồi tổng hợp nhãn.

Một khung sơ lược bằng Python cho phần truy vấn, giả định đã có sẵn hàm `embed()` trả về vector và một collection tên `aircraft`:

```python
from pymilvus import Collection

def identify(image_path, k=10):
    vec = embed(image_path)  # ví dụ CLIP, đã chuẩn hoá L2
    coll = Collection("aircraft")
    results = coll.search(
        data=[vec],
        anns_field="embedding",
        param={"metric_type": "COSINE", "params": {"ef": 64}},
        limit=k,
        output_fields=["aircraft_type"],
    )
    votes = {}
    for hit in results[0]:
        label = hit.entity.get("aircraft_type")
        # trọng số theo độ tương đồng, gần hơn thì phiếu nặng hơn
        votes[label] = votes.get(label, 0.0) + hit.score
    return sorted(votes.items(), key=lambda x: x[1], reverse=True)
```

Vài chi tiết đáng nói. Thứ nhất là **metric**: với embedding đã chuẩn hoá độ dài về 1 (L2-normalize), khoảng cách **cosine** và khoảng cách Euclid cho thứ tự xếp hạng tương đương, nhưng cosine đọc trực quan hơn (1 là trùng khớp, 0 là vuông góc). Thứ hai là cách bỏ phiếu: đừng đếm phiếu trơn, hãy cộng theo trọng số độ tương đồng, để một láng giềng rất giống có tiếng nói nặng hơn một láng giềng chỉ giống mờ mờ. Thứ ba là tham số `ef` của HNSW: đây chính là núm vặn đánh đổi giữa tốc độ và độ chính xác, `ef` lớn thì tìm kỹ hơn nhưng chậm hơn.

# Những chỗ dễ vấp

Đây là phần mình thấy thú vị nhất, vì lý thuyết thì đẹp còn thực tế thì đầy cạm bẫy.

**Nền ảnh đánh lừa mô hình.** Nếu kho ảnh của mình toàn chụp máy bay đang bay trên nền trời xanh, còn ảnh truy vấn lại chụp ở cửa ra tàu bay với ống lồng và xe thang, embedding có thể bị chi phối bởi khung cảnh chứ không phải chiếc máy bay. Mô hình tổng quát nắm cả bối cảnh, và đôi khi bối cảnh lấn át chủ thể. Cắt cúp cho máy bay chiếm phần lớn khung hình, hoặc dùng một bước phát hiện đối tượng để khoanh vùng trước, giúp ích rất nhiều.

**Sơn màu của hãng gây nhiễu.** Đây là nghịch lý riêng của máy bay. Con người nhìn màu sơn để đoán hãng, nhưng cùng một loại **A321** có thể khoác hàng chục bộ áo khác nhau, còn hai loại khác nhau của cùng một hãng lại chung một tông màu. Nếu embedding quá nhạy với màu, hệ thống sẽ gộp nhầm theo hãng thay vì theo loại. Đây chính là lúc fine-tune với đủ ảnh đa dạng màu sơn cho mỗi loại trở nên đáng giá.

**Góc chụp.** Ảnh chụp chính diện, chụp nghiêng ba phần tư, và chụp bụng khi máy bay vừa cất cánh cho ra ba embedding rất khác nhau. Kho ảnh càng phủ nhiều góc thì càng bền. Một mẹo rẻ tiền là tăng cường dữ liệu (data augmentation) khi nạp, nhưng không gì thay được ảnh thật ở nhiều góc.

**Ngưỡng tin cậy.** Nếu chiếc máy bay trong ảnh thuộc một loại mà kho chưa từng có, hệ thống vẫn sẽ trả về một đáp án, chỉ là sai. Cần đặt một ngưỡng: nếu độ tương đồng của láng giềng gần nhất quá thấp, hãy trả lời "không chắc" thay vì đoán bừa. Một hệ thống biết nói "mình không biết" hữu ích hơn nhiều so với một hệ thống lúc nào cũng tự tin.

# Kết

Nói thật thì mình không nghĩ cách này sẽ đánh bại được một chuyên gia spotter dày dạn, những người liếc qua đã đọc ra cả biến thể lẫn số hiệu. Nhưng đó không phải mục tiêu. Cái hay của hướng tìm ảnh ngược là nó biến một bài toán "nhận dạng" khó thành một bài toán "so sánh" dễ hơn, mở rộng được, và không đòi huấn luyện lại mỗi khi có loại mới. Nó cũng phơi bày rõ ràng giới hạn của mình: chất lượng đầu ra phụ thuộc thẳng vào chất lượng và độ đa dạng của kho ảnh, chứ không phải vào một phép màu nào trong mô hình.

Mình vẫn để ngỏ vài câu hỏi. Nên fine-tune tới mức nào trước khi lợi ích không còn bù nổi công sức gắn nhãn? DINOv2 có thực sự phân biệt biến thể tốt hơn CLIP trên đúng tập máy bay của mình không? Đây là mấy thứ mình chưa đo cẩn thận, và có lẽ để dành cho một bài sau. Còn bây giờ, nó đã đủ tốt để mình vui khi chụp được một chiếc lạ ngoài sân bay.

# Tài liệu tham khảo

- Radford et al., *Learning Transferable Visual Models From Natural Language Supervision* (CLIP), OpenAI, 2021.
- Oquab et al., *DINOv2: Learning Robust Visual Features without Supervision*, Meta AI, 2023.
- He et al., *Deep Residual Learning for Image Recognition* (ResNet), 2015.
- Malkov & Yashunin, *Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs* (HNSW), 2016.
- Tài liệu chính thức của Milvus: https://milvus.io/docs

---
title: Kafka và Redis trong đường phục vụ mô hình ML
excerpt: "Một bản thiết kế kiến trúc inference bất đồng bộ: hàng đợi để bền, cache để nhanh."
permalink: /topics/kafka-redis-trong-duong-phuc-vu-ml/
categories:
  - topics
  - ai-ml
date: 2026-03-21 09:00
---


# Đường phục vụ mô hình là gì?

Về lý thuyết, một **serving path** (đường phục vụ) là toàn bộ quãng đường một request đi từ lúc người dùng bấm nút cho tới lúc nhận về kết quả suy luận của mô hình. Với các mô hình nhẹ, chúng ta thường làm kiểu **đồng bộ**: request vào, gọi model, trả kết quả ngay trong một vòng HTTP. Đơn giản, dễ debug, và đủ tốt cho rất nhiều bài toán.

Nhưng khi mô hình nặng lên (một mạng lớn, một pipeline nhiều bước, hoặc một lời gọi tới **LLM** mất vài giây), kiểu đồng bộ bắt đầu rạn. Người dùng phải ngồi chờ với một connection mở. Nếu lượng request dồn vào cùng lúc, các worker bị chiếm hết, request mới xếp hàng ngay trong tầng web, và một sự cố nhỏ ở model server lan ngược ra tận trình duyệt. Đây chính là lúc chúng ta nghĩ tới một kiến trúc **inference bất đồng bộ** (asynchronous inference), với hai mảnh ghép quen thuộc: một **message queue** để tách tải, và một lớp **cache** để trả nhanh.

Bài viết này là một design write-up chung. Mình sẽ mô tả cách **Kafka** và **Redis** ghép vào nhau trong một đường phục vụ ML, cùng những đánh đổi đi kèm. Không có số liệu nội bộ nào ở đây, chỉ là kiến thức chuẩn về hai công cụ này.

# Vì sao lại tách đồng bộ và bất đồng bộ

Điểm mấu chốt là **thời gian phục vụ** của model không nằm trong tầm kiểm soát của tầng web. Một suy luận có thể mất 50ms, cũng có thể mất 8 giây nếu là một prompt dài. Nếu buộc HTTP request phải chờ trọn vẹn khoảng đó, chúng ta đang ghép chặt hai thứ vốn nên rời nhau: **độ khả dụng của API** và **độ trễ của mô hình**.

Cách tách kinh điển là **produce rồi consume**. Tầng API nhận request, sinh một `job_id`, đẩy công việc vào một hàng đợi, rồi trả về ngay `202 Accepted` kèm `job_id`. Một nhóm worker riêng đọc từ hàng đợi, chạy mô hình, ghi kết quả vào nơi client có thể lấy lại. Client hoặc poll bằng `job_id`, hoặc chờ một sự kiện đẩy về (WebSocket, SSE, webhook).

*Hàng đợi biến một đỉnh tải nhọn thành một dòng chảy đều mà worker có thể tiêu hoá theo nhịp của nó.*

# Kafka: xương sống của luồng công việc

**Kafka** là một nền tảng **distributed log** (nhật ký phân tán), không đơn thuần là một message queue kiểu cũ. Thay vì "lấy ra rồi xoá", Kafka ghi mọi message vào một **log** có thứ tự và giữ lại theo thời gian cấu hình. Consumer đọc bằng cách dịch chuyển một con trỏ gọi là **offset**. Vài khái niệm cần nắm cho đường serving:

1. **Topic**: một luồng tên gọi, ví dụ `inference-requests` và `inference-results`.
2. **Partition**: mỗi topic chia thành nhiều **partition**; thứ tự chỉ được đảm bảo *trong* một partition, và đây cũng là đơn vị song song hoá.
3. **Consumer group**: nhiều worker cùng một group chia nhau các partition, mỗi partition tại một thời điểm chỉ do một consumer trong group xử lý.
4. **Key**: message có thể mang một **key**; Kafka băm key để chọn partition, nhờ đó mọi request cùng một `user_id` rơi vào cùng một partition và giữ đúng thứ tự.

Trong bản thiết kế, tầng API đóng vai **producer** đẩy job vào `inference-requests`. Số **partition** đặt ra trần cho mức song song: nếu topic có 12 partition thì tối đa 12 consumer trong một group chạy song song. Muốn tăng thông lượng, chúng ta tăng partition và thêm worker. Đây là điểm Kafka toả sáng: **khả năng mở rộng ngang** một cách rõ ràng và có thể suy luận được.

Một tính chất quý nữa là **độ bền** (durability). Vì Kafka giữ log và replicate qua nhiều broker, nếu một worker chết giữa chừng thì message không mất; một worker khác trong group tiếp quản partition và đọc lại từ **offset** đã commit. Với ML, điều này nghĩa là một job inference tốn kém không bốc hơi chỉ vì một pod restart.

```bash
# Ví dụ tạo topic cho request, ưu tiên nhiều partition để song song
kafka-topics.sh --create \
  --topic inference-requests \
  --partitions 12 \
  --replication-factor 3 \
  --bootstrap-server localhost:9092
```

Về mặt phân phối (delivery), Kafka mặc định thiên về **at-least-once**: một message có thể được xử lý lại nếu worker chết sau khi làm xong nhưng trước khi commit offset. Hệ quả thực tế cho ML là các job nên **idempotent** (chạy lại cho cùng kết quả), hoặc ít nhất phải phát hiện được job đã hoàn tất để không tính phí suy luận hai lần. Đây là một ràng buộc thiết kế, không phải một lỗi.

# Redis: lớp nhanh cho kết quả và trạng thái

Nếu Kafka lo phần "bền và có thứ tự", thì **Redis** lo phần "nhanh và tra cứu tức thời". Redis là một kho dữ liệu **in-memory**, đọc ghi ở mức dưới một mili giây, và trong đường serving nó gánh vài vai trò rất khác nhau:

- **Kho kết quả tạm**: worker ghi `result:{job_id}` vào Redis kèm **TTL** (time to live), client poll bằng `job_id` để lấy về. Kết quả không cần sống mãi, vài phút tới vài giờ là đủ, nên TTL tự dọn rác giúp chúng ta.
- **Cache suy luận**: nếu cùng một input rất hay lặp lại, chúng ta có thể cache theo một khoá băm của input, ví dụ `pred:{sha256(input)}`. Một **cache hit** cho phép bỏ qua toàn bộ chặng Kafka và model, trả kết quả gần như tức thời. Với các mô hình đắt tiền, tỉ lệ hit dù chỉ vừa phải cũng cắt được đáng kể chi phí tính toán.
- **Bảng trạng thái job**: một `HASH` mô tả `queued`, `running`, `done`, `failed` để API trả lời "job của bạn đang ở đâu" mà không phải đụng tới Kafka.
- **Rate limit và idempotency key**: một `INCR` kèm TTL đủ để chặn lạm dụng; một `SET NX` trên `job_id` giúp chống việc submit trùng.

```text
SET  pred:9f2c...ab   "<json kết quả>"   EX 3600     # cache 1 giờ
HSET job:42  status running  worker w-7
GET  result:42                                        # client poll về đây
```

Một điểm cần tỉnh táo: Redis mặc định là **in-memory**, nên coi nó như một lớp *có thể mất* mà không được phá vỡ tính đúng đắn. Redis có cơ chế bền hoá (**RDB** snapshot và **AOF** append-only file), nhưng ngay cả vậy, triết lý an toàn vẫn là: **nguồn sự thật nằm ở Kafka và kho lưu trữ lâu dài**, còn Redis là bản sao nhanh để tăng tốc. Nếu Redis trống rỗng sau một lần restart, hệ thống nên tự tái tạo được từ log, chứ không nên coi như mất dữ liệu vĩnh viễn.

# Ghép lại thành một đường phục vụ

Gộp hai mảnh, luồng đầy đủ trông như sau:

1. Client gửi request tới API. API tính khoá cache và hỏi Redis trước.
2. **Cache hit**: trả kết quả ngay, kết thúc. Đây là đường nhanh nhất và rẻ nhất.
3. **Cache miss**: API sinh `job_id`, ghi trạng thái `queued` vào Redis, **produce** message vào topic `inference-requests` với **key** phù hợp, rồi trả `202` kèm `job_id`.
4. Một worker trong **consumer group** đọc message, cập nhật trạng thái `running`, chạy mô hình.
5. Worker ghi kết quả vào Redis (`result:{job_id}` kèm TTL) và cập nhật cache dự đoán. Nếu cần thông báo đẩy, worker **produce** vào `inference-results` để tầng gateway đẩy qua WebSocket về client.
6. Client poll bằng `job_id`, hoặc nhận sự kiện đẩy.

Điểm đẹp của kiến trúc này là mỗi phần hỏng theo cách riêng của nó mà không kéo sập cả hệ thống. Model server chậm? Message dồn trong Kafka, worker tiêu hoá dần, API vẫn nhận request bình thường. Redis restart? Cache nguội đi và tỉ lệ hit giảm một lúc, nhưng job vẫn chạy đúng nhờ Kafka. Một worker chết? Partition của nó được group tái phân bổ.

# Những đánh đổi thành thật

Không có bữa trưa miễn phí. Kiến trúc này gánh một cái giá rõ rệt:

- **Độ phức tạp vận hành tăng mạnh.** Một Kafka cluster nhiều broker cộng một Redis (thường là cụm hoặc có replica) là hai hệ phân tán trạng thái phải nuôi, phải giám sát, phải nâng cấp. Với một dịch vụ nhỏ, cái giá này thường không đáng.
- **Độ trễ đường bất đồng bộ có sàn.** Việc qua hàng đợi, cập nhật trạng thái, poll kết quả đều thêm chặng. Với các request cần trả lời tức thì và mô hình vốn đã nhẹ, đường đồng bộ trực tiếp vẫn tốt hơn.
- **Ngữ nghĩa at-least-once đòi hỏi kỷ luật.** Nếu suy luận có tác dụng phụ (ghi DB, tính phí, gửi mail), chúng ta phải thiết kế idempotency một cách chủ động.
- **Cache có thể phục vụ kết quả cũ.** Nếu mô hình được cập nhật, khoá cache cần gắn thêm phiên bản mô hình (`pred:{model_version}:{hash}`), nếu không người dùng nhận dự đoán của mô hình đời trước.

# Khi nào nên và khi nào không

Mình nghĩ không có câu trả lời gọn ghẽ, và đó cũng là điều làm bài toán này thú vị. Kafka cộng Redis là một cặp rất mạnh khi tải lớn, mô hình nặng, cần cách ly sự cố, và cần mở rộng ngang một cách có thể suy luận. Nhưng nó cũng là một kiến trúc dễ bị áp dụng quá sớm, vì nó "trông giống hệ thống nghiêm túc". Rất nhiều dịch vụ ML sống khoẻ với một API đồng bộ, một hàng đợi tối giản, và một cache nhỏ, cho tới ngày các con số thực sự bắt chúng ta phải tách rời các lớp ra.

Nếu phải chốt một nguyên tắc, mình chọn thế này: dùng **Kafka** khi bạn cần *độ bền và thông lượng có thứ tự*, dùng **Redis** khi bạn cần *tốc độ và tra cứu tức thời*, và đừng thêm cái nào trong hai cho tới khi bạn chỉ ra được đúng vấn đề mà nó giải quyết. Kiến trúc tốt nhất thường là kiến trúc nhỏ nhất còn chịu được tải của ngày mai, không hơn.

# Tài liệu tham khảo

- Apache Kafka, tài liệu chính thức: https://kafka.apache.org/documentation/
- Redis, tài liệu chính thức: https://redis.io/docs/latest/
- Jay Kreps, "The Log: What every software engineer should know about real-time data's unifying abstraction" (LinkedIn Engineering)
- Martin Kleppmann, *Designing Data-Intensive Applications* (O'Reilly), các chương về replication, stream processing và message queue
- Redis, tài liệu về persistence (RDB và AOF): https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/

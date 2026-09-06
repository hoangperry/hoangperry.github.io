---
title: Tiếp cận ILS hoạt động thế nào
excerpt: "Nối tiếp phần giấy phép IFR: localizer, glideslope, và các category của một đường tiếp cận chính xác."
permalink: /topics/tiep-can-ils-hoat-dong-the-nao/
categories:
  - topics
  - aviation
date: 2026-02-22 09:00
---

Ở bài trước về giấy phép **IFR** (Instrument Flight Rules), chúng ta đã nói tới chuyện bay khi không nhìn thấy gì bên ngoài buồng lái: phi công tin vào đồng hồ thay vì tin vào mắt. Nhưng bay hành trình trong mây là một chuyện, còn hạ cánh trong mây lại là chuyện khác hẳn. Máy bay phải chui xuống qua lớp mây thấp, tìm đúng đường băng, đúng độ dốc, đúng tốc độ hạ, và làm tất cả những việc đó mà mắt thường gần như vô dụng cho tới những giây cuối cùng. Công cụ cổ điển và vẫn còn phổ biến nhất để làm việc này là **ILS**, viết tắt của **Instrument Landing System**.

Bài này mình muốn giải thích ILS hoạt động ra sao: hai thành phần vô tuyến chính, cách kim chỉ dẫn trong buồng lái, và tại sao người ta lại chia ILS thành các **category** khác nhau.

## ILS là gì?

Về lý thuyết, **ILS** là một hệ thống dẫn đường vô tuyến mặt đất phát ra hai chùm tín hiệu vuông góc nhau để định nghĩa một "đường trượt" duy nhất dẫn máy bay xuống chạm ngưỡng đường băng. Một chùm cho biết máy bay lệch trái hay lệch phải so với tim đường băng, một chùm cho biết máy bay cao hay thấp so với góc hạ chuẩn. Khi cả hai đều canh giữa, máy bay đang nằm đúng trên con dốc vô hình dẫn tới điểm chạm bánh.

Điểm hay của ILS là nó là một hệ thống **chính xác** (precision approach): nó cho cả dẫn hướng ngang lẫn dẫn hướng đứng. Nhiều kiểu tiếp cận khác, ví dụ **VOR** hay **NDB**, chỉ cho dẫn hướng ngang, còn độ cao thì phi công tự canh theo bảng và theo đồng hồ độ cao. ILS thì "cầm tay" cả hai trục.

## Lịch sử

ILS không phải công nghệ mới. Những thử nghiệm đầu tiên đã có từ thập niên 1930, và chuyến hạ cánh hoàn toàn theo thiết bị được ghi nhận công khai đầu tiên diễn ra năm 1938 tại sân bay ở Pittsburgh, khi một chiếc Boeing 247D của hãng Pennsylvania Central Airlines hạ cánh chỉ dựa vào tín hiệu vô tuyến. Sau Thế chiến thứ hai, **ICAO** (International Civil Aviation Organization) chuẩn hoá ILS thành phương tiện tiếp cận chính xác tiêu chuẩn quốc tế, và trong nhiều thập niên nó gần như là lựa chọn duy nhất cho tiếp cận trong tầm nhìn kém.

Điều thú vị là dù ngày nay đã có tiếp cận dựa trên vệ tinh (**GPS**/**GNSS** với các thủ tục như **LPV**), ILS vẫn được lắp và duy trì ở phần lớn các đường băng lớn, vì nó độc lập với vệ tinh và đã được chứng minh độ tin cậy qua hàng chục năm.

## Localizer: canh trái phải

Thành phần đầu tiên là **localizer**. Đây là một dàn antenna đặt ở đầu xa của đường băng (phía đối diện với hướng máy bay đang tới), phát trong dải tần **VHF** khoảng 108 tới 112 MHz. Localizer phát hai tín hiệu điều chế chồng lên nhau: một bên nghiêng về tần số điều chế **150 Hz**, một bên **90 Hz**.

Cách hoạt động có thể hình dung như sau:

1. Nửa không gian bên phải tim đường băng được "nhuộm" đậm tín hiệu 150 Hz.
2. Nửa không gian bên trái được nhuộm đậm tín hiệu 90 Hz.
3. Đúng trên tim đường băng, hai tín hiệu cân bằng nhau.

Máy thu trên máy bay so sánh cường độ hai tín hiệu này. Nếu 150 Hz trội hơn, tức máy bay đang lệch phải, kim chỉ hướng dẫn (kim dọc, thường gọi là **CDI**, Course Deviation Indicator) sẽ lệch sang trái để bảo phi công "bay sang trái mà về tim". Nguyên tắc là bay về phía kim. Localizer thường phủ một chùm hẹp cỡ vài độ, nên càng gần đường băng thì mỗi độ lệch càng nhạy.

## Glideslope: canh cao thấp

Thành phần thứ hai là **glideslope** (còn gọi là **glide path**). Antenna glideslope đặt gần điểm chạm bánh, bên cạnh đường băng, và phát trong dải **UHF** khoảng 329 tới 335 MHz. Nguyên lý y hệt localizer, chỉ khác là chùm tín hiệu được dựng theo phương đứng để định nghĩa một góc dốc hạ, phổ biến nhất là **3 độ**.

Cũng lại là cặp tín hiệu 90 Hz và 150 Hz, nhưng lần này:

1. Vùng phía trên góc dốc trội tín hiệu 90 Hz.
2. Vùng phía dưới góc dốc trội tín hiệu 150 Hz.
3. Đúng trên góc 3 độ, hai tín hiệu cân bằng.

Kim ngang trong buồng lái cho biết máy bay đang cao hay thấp. Nếu máy bay bay cao hơn con dốc, kim tụt xuống, ý bảo "chúc mũi xuống một chút". Khi cả kim dọc và kim ngang đều nằm giao nhau ở giữa, máy bay đang nằm gọn trên đường trượt cả hai trục.

Một lưu ý kỹ thuật đáng nói: chùm glideslope có những "thuỳ" giả (false lobe) ở các góc cao hơn, ví dụ khoảng 6 độ, 9 độ. Vì thế phi công không bao giờ được bắt glideslope từ phía trên xuống; họ luôn bay bằng ở dưới góc dốc rồi chờ chùm 3 độ đi tới, để tránh khoá nhầm vào một thuỳ giả và cắm dốc quá gắt.

## Marker beacon và các phần phụ trợ

Ngày xưa dọc đường tiếp cận ILS còn có các **marker beacon** phát thẳng đứng lên trời để báo khoảng cách: **outer marker**, **middle marker**, và đôi khi **inner marker**. Khi bay qua, đèn trong buồng lái nhấp nháy kèm âm thanh, cho phi công biết mình đang ở mốc nào. Ngày nay marker beacon phần lớn đã bị thay bằng **DME** (Distance Measuring Equipment), cho ra khoảng cách liên tục theo dặm thay vì chỉ báo tại vài điểm rời rạc.

## Các category

Đây là phần mà nhiều người hay thắc mắc. ILS được ICAO phân thành các **category**, và về cơ bản category càng cao thì máy bay được phép xuống càng thấp trong tầm nhìn càng kém trước khi phi công buộc phải nhìn thấy đường băng hoặc phải bay lên (go-around). Hai con số quan trọng ở đây là **decision height (DH)**, độ cao quyết định, và **RVR** (Runway Visual Range), tầm nhìn dọc đường băng.

Có thể tóm tắt gần đúng như sau:

| Category | Decision height | RVR xấp xỉ |
|----------|-----------------|------------|
| CAT I | không thấp hơn ~200 ft | ~550 m trở lên |
| CAT II | ~100 tới 200 ft | ~300 m |
| CAT IIIa | dưới 100 ft hoặc không có DH | ~200 m |
| CAT IIIb | dưới 50 ft hoặc không có DH | ~50 tới 200 m |
| CAT IIIc | không giới hạn | về lý thuyết là 0 |

Các con số trên là giá trị điển hình để hình dung, tiêu chuẩn cụ thể có thể khác nhau đôi chút giữa các nhà chức trách; đừng dùng bảng này để bay thật.

Vài điểm cần hiểu cho đúng:

- **CAT I** là cấp phổ biến nhất, gần như mọi đường băng có ILS đều có ít nhất CAT I. Phi công phải nhìn thấy đường băng ở khoảng 200 ft; nếu không thấy thì bay lên.
- **CAT II** và **CAT III** đòi hỏi thiết bị mặt đất tốt hơn, đường băng được bảo vệ chặt hơn khỏi vật cản và nhiễu, và quan trọng là máy bay phải có **autoland** hoặc hệ thống lái tự động đủ tin cậy, cộng với phi công được huấn luyện và cấp phép riêng cho cấp đó.
- **CAT IIIc** trên lý thuyết cho phép hạ cánh với tầm nhìn bằng không, nhưng trên thực tế gần như không dùng, vì kể cả khi máy bay đã chạm bánh an toàn thì phi công vẫn cần đủ tầm nhìn để lăn ra khỏi đường băng.

Điểm mấu chốt là category không phải thuộc tính riêng của cái antenna ILS, mà là sự kết hợp của ba thứ: chất lượng trạm mặt đất, khả năng của máy bay, và trình độ được cấp phép của tổ lái. Thiếu một trong ba thì không được dùng cấp cao, dù trạm phát có khả năng đi nữa.

## Vài giới hạn của ILS

ILS đẹp nhưng không hoàn hảo. Chùm tín hiệu, đặc biệt là glideslope, rất nhạy với địa hình và vật cản phản xạ. Một chiếc máy bay khác đang lăn qua khu vực nhạy cảm, hay thậm chí xe cộ, cũng có thể làm cong tín hiệu, nên khi thời tiết xuống thấp người ta phải giữ trống các vùng bảo vệ quanh antenna. Mỗi đường ILS cũng chỉ phục vụ một hướng của một đường băng; muốn hạ theo hướng ngược lại phải có một bộ ILS khác. Đây chính là chỗ mà tiếp cận dựa trên vệ tinh có lợi thế mềm dẻo hơn, vì nó không cần phần cứng phát cho từng hướng.

## Kết

Nói cho gọn, ILS là một mẹo vô tuyến rất thanh lịch: dùng hai cặp tín hiệu 90 Hz và 150 Hz cân bằng nhau để vẽ ra một con dốc vô hình trong không gian, rồi để hai cây kim trong buồng lái dẫn phi công men theo con dốc đó xuống đường băng. Localizer lo trái phải, glideslope lo cao thấp, và các category quyết định người ta được tin vào hệ thống này tới mức nào khi trời mù.

Điều mình thấy thú vị là một công nghệ có gốc rễ từ thập niên 1930 vẫn đang đưa hàng nghìn chuyến bay hạ cánh an toàn mỗi ngày, song song với vệ tinh hiện đại. Có lẽ đó là cách hàng không vận hành: cái gì đã chứng minh được độ tin cậy thì người ta giữ lại rất lâu, ngay cả khi đã có thứ mới hơn.

## Tài liệu tham khảo

- ICAO Annex 10, Aeronautical Telecommunications (tiêu chuẩn về ILS và các cấp category).
- FAA, Instrument Flying Handbook (FAA-H-8083-15), chương về tiếp cận chính xác.
- Wikipedia, "Instrument landing system".
- SKYbrary, mục "Instrument Landing System (ILS)".

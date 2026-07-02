---
title: Cấu trúc một pipeline OCR
excerpt: "Tiền xử lý, phát hiện vùng chữ, nhận dạng: ba mảnh ghép của một hệ OCR thực dụng."
permalink: /topics/cau-truc-mot-pipeline-ocr/
categories:
  - topics
  - ai-ml
date: 2026-04-17 09:00
---

# OCR là gì?

Về lý thuyết, **OCR** (**Optical Character Recognition**, nhận dạng ký tự quang học) là bài toán biến một tấm ảnh chứa chữ thành chuỗi văn bản mà máy tính đọc được. Nghe thì đơn giản, kiểu "nhìn vào ảnh rồi đọc ra chữ", nhưng nếu chúng ta ngồi bóc tách quá trình đó ra thì sẽ thấy nó không phải là một phép biến đổi duy nhất, mà là một chuỗi các bước nối tiếp nhau. Đó chính là lý do người ta hay gọi nó là một **pipeline** chứ không phải một mô hình đơn lẻ.

Mình muốn viết bài này như một bản mô tả kiến trúc: một hệ OCR thực dụng được ghép từ những mảnh nào, mỗi mảnh giải quyết chuyện gì, và vì sao tách chúng ra lại tiện hơn là gộp tất cả vào một cục.

Một điểm cần phân biệt ngay từ đầu. Có hai bối cảnh rất khác nhau. Thứ nhất là **document OCR**: ảnh scan tài liệu, hóa đơn, sách, form. Ảnh loại này thường phẳng, chữ nằm ngay ngắn, nền sạch. Thứ hai là **scene text**, tức là chữ nằm trong ảnh chụp đời thường: biển hiệu, biển số xe, chữ trên bao bì. Loại thứ hai khó hơn nhiều vì chữ bị nghiêng, cong, phối cảnh, ánh sáng loạn xạ. Kiến trúc pipeline mình mô tả dưới đây áp dụng cho cả hai, nhưng độ nặng của từng bước sẽ khác nhau tùy bối cảnh.

# Lịch sử ngắn

OCR không phải chuyện mới. Từ những năm 1970, **Ray Kurzweil** đã làm ra máy đọc chữ cho người khiếm thị, và các hệ thương mại đọc tài liệu in đã tồn tại rất lâu trước khi deep learning phổ biến. Thời đó cách làm chủ đạo là **template matching** và trích đặc trưng thủ công: nhị phân hóa ảnh, cắt từng ký tự ra, rồi so khớp hình dạng với bộ mẫu. Cách này chạy tốt với font in chuẩn, nền trắng, nhưng gần như bó tay với chữ viết tay hay ảnh chụp ngoài đời.

Bước ngoặt đến khi mạng nơ-ron tiếp quản cả khâu nhận dạng lẫn khâu phát hiện. Hai ý tưởng đáng nhớ: **CTC** (**Connectionist Temporal Classification**, Graves và cộng sự, 2006) cho phép huấn luyện nhận dạng cả dòng chữ mà không cần cắt sẵn từng ký tự, và các mô hình phát hiện vùng chữ dựa trên mạng tích chập giúp tìm chữ trong ảnh phức tạp. Từ đó pipeline OCR hiện đại định hình thành ba khối mà chúng ta sẽ đi qua lần lượt.

# Ba khối chính

Một hệ OCR thực dụng, bất kể dùng thư viện nào, gần như luôn có thể chia thành ba khối:

1. **Tiền xử lý** (**preprocessing**): làm sạch và nắn thẳng ảnh đầu vào.
2. **Phát hiện vùng chữ** (**text detection**): tìm ra chữ nằm ở đâu trong ảnh.
3. **Nhận dạng** (**text recognition**): đọc nội dung của từng vùng chữ đã tìm được.

Nhiều khi người ta thêm một khối thứ tư ở cuối là **hậu xử lý** (**post-processing**), nhưng ba khối trên là xương sống. Điểm hay của cách chia này là mỗi khối có thể thay thế độc lập. Chúng ta có thể đổi mô hình nhận dạng mà không đụng gì đến khâu phát hiện, hoặc thêm một bước nắn ảnh mới mà phần còn lại vẫn nguyên.

## Tiền xử lý

Đây là khối ít hào nhoáng nhất nhưng lại quyết định phần lớn chất lượng cuối cùng. Ý tưởng đơn giản: đưa ảnh về trạng thái mà các khối sau dễ làm việc nhất. Với document OCR, các thao tác kinh điển gồm:

- **Chuyển xám** (grayscale): bỏ màu, giữ độ sáng, giảm chiều dữ liệu.
- **Nhị phân hóa** (binarization): tách chữ (đen) khỏi nền (trắng). Phương pháp **Otsu** chọn ngưỡng toàn cục tự động, còn **adaptive thresholding** chọn ngưỡng cục bộ theo từng vùng, hữu ích khi ánh sáng không đều.
- **Khử nghiêng** (deskew): ảnh scan hay bị lệch vài độ. Ước lượng góc nghiêng rồi xoay lại giúp dòng chữ nằm ngang, khâu phát hiện dòng sau đó nhẹ đi nhiều.
- **Khử nhiễu** (denoise) và **loại bỏ đường kẻ**: với form và bảng biểu, các đường kẻ ô hay dính vào chữ.

Một lưu ý thực dụng: đừng nhị phân hóa quá tay. Với chữ mờ hoặc nền phức tạp, việc ép ảnh về đen trắng có thể xóa mất nét chữ. Nhiều mô hình nhận dạng hiện đại thích ăn ảnh xám hoặc ảnh màu hơn là ảnh nhị phân, vì chúng tự học được cách bỏ nhiễu. Nói cách khác, mức độ tiền xử lý cần cân theo mô hình phía sau, chứ không có công thức chung.

## Phát hiện vùng chữ

Khối này trả lời câu hỏi "chữ nằm ở đâu". Đầu ra thường là một tập các hộp bao (**bounding box**) hoặc đa giác bao quanh từng từ hoặc từng dòng. Có hai họ tiếp cận chính.

Họ thứ nhất dựa trên **hộp** (box-based), kế thừa từ các mô hình phát hiện vật thể như SSD hay Faster R-CNN, coi mỗi chữ như một "vật thể" cần khoanh vùng. **EAST** (**Efficient and Accurate Scene Text detector**) là một đại diện quen thuộc: nó dự đoán trực tiếp các hộp xoay được, chạy nhanh, hợp với chữ nằm tương đối thẳng.

Họ thứ hai dựa trên **phân đoạn** (segmentation-based). Thay vì dự đoán hộp, mô hình dự đoán ở mức pixel xem điểm nào thuộc vùng chữ, rồi gộp các pixel lại thành vùng. **CRAFT** (**Character Region Awareness for Text detection**) đi theo hướng này, dự đoán vùng ký tự và mức độ liên kết giữa các ký tự, nhờ vậy xử lý tốt chữ cong và chữ có khoảng cách bất thường. **DBNet** thì học luôn một ngưỡng nhị phân khả vi để tách vùng chữ, cân bằng khá tốt giữa tốc độ và độ chính xác, và là mặc định trong nhiều bộ OCR mã nguồn mở.

Vì sao tách riêng khâu phát hiện? Vì trong đa số ảnh thực tế, chữ chỉ chiếm một phần nhỏ diện tích. Bắt mô hình nhận dạng đọc cả tấm ảnh vừa tốn kém vừa dễ sai. Khoanh vùng trước rồi mới đọc là một cách chia để trị rất tự nhiên.

## Nhận dạng

Sau khi có các vùng chữ, mỗi vùng được cắt ra, nắn về dạng chữ nhật (một số hệ có thêm bước **rectification** để duỗi chữ cong về thẳng), rồi đưa vào khối nhận dạng để đọc nội dung. Đây là nơi có nhiều lựa chọn kiến trúc thú vị nhất.

Kiến trúc kinh điển là **CRNN** (**Convolutional Recurrent Neural Network**): một khối tích chập trích đặc trưng từ ảnh dòng chữ, một khối hồi tiếp (thường là **BiLSTM**) mô hình hóa thứ tự trái sang phải, và một tầng **CTC** để giải mã ra chuỗi ký tự. Cái đẹp của CTC là nó cho phép huấn luyện với nhãn chỉ là chuỗi văn bản, không cần biết mỗi ký tự nằm ở cột pixel nào. Đại khái, CTC căn chỉnh mềm giữa các cột đặc trưng và các ký tự, cho phép ký tự lặp và ký tự trống rồi thu gọn lại.

Họ thứ hai là **attention-based** và gần đây là **Transformer**. Ở đây quá trình đọc được mô hình như một bài toán dịch: từ chuỗi đặc trưng ảnh sinh ra chuỗi ký tự, mỗi bước "chú ý" vào phần ảnh liên quan. **TrOCR** của Microsoft là một ví dụ, dùng encoder thị giác kiểu ViT và decoder ngôn ngữ kiểu Transformer. Cách này thường mạnh hơn với chữ viết tay và ngữ cảnh phức tạp, vì decoder mang sẵn một chút hiểu biết ngôn ngữ, nhưng đổi lại nặng hơn và cần nhiều dữ liệu hơn.

Chọn cái nào là một trade-off khá rõ. CTC nhẹ, nhanh, dễ triển khai trên thiết bị yếu, rất hợp document OCR font in. Attention/Transformer chính xác hơn ở ca khó nhưng tốn tài nguyên. Trong thực tế nhiều hệ thống chạy CTC làm mặc định và chỉ dồn ảnh khó sang mô hình nặng hơn.

# Hậu xử lý, mảnh ghép hay bị quên

Đầu ra thô của khối nhận dạng hiếm khi hoàn hảo. Đây là lúc **hậu xử lý** kiếm điểm. Một vài thao tác thường gặp: sửa lỗi bằng **từ điển** hoặc **mô hình ngôn ngữ** (ví dụ "rn" bị đọc nhầm thành "m", hay "0" và "O" lẫn lộn), ràng buộc định dạng khi biết trước kiểu dữ liệu (ngày tháng, mã số thuế, biển số), và ghép lại bố cục từ các hộp rời rạc thành đoạn văn, bảng, cột theo đúng thứ tự đọc.

Với hóa đơn và form, khâu này thường quan trọng ngang khâu nhận dạng. Đọc đúng từng ký tự mà xếp sai thứ tự cột thì kết quả vẫn vô dụng. Nhiều hệ hiện nay gọi phần này là **layout analysis** và đầu tư khá nặng vào nó.

# Ghép lại thành một dòng chảy

Nếu tóm cả pipeline vào một câu, nó chạy thế này: ảnh vào, được làm sạch và nắn thẳng ở khâu tiền xử lý, đưa qua khâu phát hiện để tìm các vùng chữ, mỗi vùng được cắt và đọc ở khâu nhận dạng, rồi các mẩu văn bản được ráp lại và sửa ở khâu hậu xử lý. Một số bộ hiện đại gộp phát hiện và nhận dạng vào một mô hình huấn luyện đầu-cuối (**end-to-end**) để hai khâu tối ưu cùng nhau, nhưng ngay cả khi đó, về mặt khái niệm ba vai trò vẫn còn nguyên đó.

Điểm mình muốn nhấn mạnh là tính module. Khi một hệ OCR đọc sai, việc đầu tiên nên làm không phải là đổi cả mô hình, mà là hỏi lỗi nằm ở khối nào. Nếu vùng chữ bị bỏ sót, đó là chuyện của khâu phát hiện. Nếu vùng đúng mà chữ đọc bậy, đó là khâu nhận dạng hoặc tiền xử lý quá tay. Nếu từng chữ đúng mà bố cục loạn, đó là hậu xử lý. Chia pipeline ra không chỉ để dễ xây, mà còn để dễ chẩn đoán.

Mình để ngỏ một chút ở đây, vì ranh giới giữa các khối đang mờ dần. Các mô hình thị giác-ngôn ngữ lớn giờ có thể "đọc" cả tấm ảnh tài liệu trong một lần suy luận, làm người ta tự hỏi liệu pipeline ba khối có còn là cách đúng để nghĩ nữa không. Cá nhân mình vẫn thấy cách chia này hữu ích, ít nhất là như một khung tư duy, kể cả khi cài đặt thực tế đã gộp nhiều thứ lại. Có thể vài năm nữa mình sẽ nghĩ khác, và như vậy cũng chẳng sao.

# Tài liệu tham khảo

- Graves et al., "Connectionist Temporal Classification: Labelling Unsegmented Sequence Data with Recurrent Neural Networks", ICML 2006.
- Shi, Bai, Yao, "An End-to-End Trainable Neural Network for Image-based Sequence Recognition (CRNN)", 2015.
- Zhou et al., "EAST: An Efficient and Accurate Scene Text Detector", CVPR 2017.
- Baek et al., "Character Region Awareness for Text Detection (CRAFT)", CVPR 2019.
- Liao et al., "Real-time Scene Text Detection with Differentiable Binarization (DBNet)", AAAI 2020.
- Li et al., "TrOCR: Transformer-based Optical Character Recognition with Pre-trained Models", 2021.
- Tesseract OCR, tài liệu chính thức trên GitHub (tesseract-ocr/tesseract).
- Wikipedia, "Optical character recognition".

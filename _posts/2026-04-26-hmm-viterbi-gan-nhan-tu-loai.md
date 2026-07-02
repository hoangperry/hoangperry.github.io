---
title: Gán nhãn từ loại bằng HMM và Viterbi
excerpt: "Hoàn thiện phần lý thuyết HMM bằng một bộ gán nhãn từ loại chạy được cho tiếng Việt, kèm code."
permalink: /topics/hmm-viterbi-gan-nhan-tu-loai/
categories:
  - topics
  - ai-ml
date: 2026-04-26 09:00
---

Trong bài về **Hidden Markov Model (HMM)** trước đây, chúng ta đã dừng lại ở phần lý thuyết: mô hình có gì, các xác suất được định nghĩa ra sao, và ba bài toán kinh điển mà một HMM phải trả lời. Bài này mình muốn khép lại phần còn dang dở đó bằng một thứ cụ thể sờ được: một bộ **gán nhãn từ loại (Part-of-Speech tagging)** cho tiếng Việt, chạy được, có code, và giải thích từng bước tại sao nó ra kết quả như vậy.

*Ý tưởng cốt lõi: gán nhãn từ loại là bài toán tìm chuỗi trạng thái ẩn hợp lý nhất cho một chuỗi quan sát, và **thuật toán Viterbi** chính là công cụ giải nó.*

# Gán nhãn từ loại là gì?

**Part-of-Speech tagging**, hay gọi tắt là **POS tagging**, là việc gán cho mỗi từ trong câu một nhãn từ loại: danh từ, động từ, tính từ, giới từ, và vân vân. Ví dụ với câu "học sinh học bài", ta muốn máy đọc ra:

```
học sinh/N  học/V  bài/N
```

Nghe qua thì tưởng đơn giản, tra từ điển là xong. Nhưng vấn đề nằm ở chỗ nhập nhằng **(ambiguity)**. Từ "học" trong ví dụ trên vừa có thể là danh từ (trong "học sinh") vừa có thể là động từ (trong "học bài"). Con người phân biệt được nhờ ngữ cảnh, còn máy thì cần một mô hình để lượng hóa cái ngữ cảnh đó. Tiếng Việt còn khó thêm một bậc vì ranh giới từ không trùng ranh giới âm tiết: "học sinh" là một từ gồm hai âm tiết, nên trước khi gán nhãn chúng ta ngầm giả định câu đã được **tách từ (word segmentation)** xong xuôi. Trong bài này mình giả định đầu vào đã là chuỗi token đã tách từ, để tập trung vào phần gán nhãn.

# Vì sao dùng HMM cho việc này?

Ta mô hình hóa câu như sau. Chuỗi các nhãn từ loại `t_1, t_2, ..., t_n` là **chuỗi trạng thái ẩn**: ta không quan sát trực tiếp được chúng, đó chính là thứ cần suy ra. Chuỗi các từ `w_1, w_2, ..., w_n` là **chuỗi quan sát**: đây là dữ liệu ta nhìn thấy. Mục tiêu là tìm chuỗi nhãn có xác suất hậu nghiệm lớn nhất:

`t* = argmax P(t_1..t_n | w_1..w_n)`

Dùng quy tắc Bayes và bỏ mẫu số (vì nó không phụ thuộc vào `t`), ta được:

`t* = argmax P(w_1..w_n | t_1..t_n) · P(t_1..t_n)`

HMM đơn giản hóa vế phải bằng hai giả định quen thuộc. Thứ nhất, **giả định Markov**: một nhãn chỉ phụ thuộc vào nhãn ngay trước nó, chứ không phải cả lịch sử. Thứ hai, **giả định độc lập của quan sát**: một từ chỉ phụ thuộc vào nhãn của chính nó. Với hai giả định này, biểu thức gọn lại thành tích của hai loại xác suất:

`t* = argmax ∏ P(w_i | t_i) · P(t_i | t_{i-1})`

Trong đó có hai bảng số cần học từ dữ liệu:

1. **Xác suất phát xạ (emission)** `P(w_i | t_i)`: khi trạng thái là nhãn `t_i`, khả năng sinh ra từ `w_i` là bao nhiêu. Ví dụ `P(học | V)`.
2. **Xác suất chuyển (transition)** `P(t_i | t_{i-1})`: khả năng nhãn `t_i` đứng ngay sau nhãn `t_{i-1}`. Ví dụ `P(V | N)`, khả năng một động từ đi ngay sau một danh từ.

Đây chính là mô hình HMM bậc một, còn gọi là **bigram tagger** vì transition chỉ nhìn một nhãn lùi về trước.

# Huấn luyện: chỉ là đếm

Điểm dễ chịu của HMM có giám sát là "huấn luyện" thực ra chỉ là đếm tần suất trên một kho ngữ liệu **(corpus)** đã được gán nhãn tay. Không có gradient descent, không có epoch. Ta ước lượng theo hợp lý cực đại **(maximum likelihood estimation)**:

`P(w | t) = count(t, w) / count(t)`

`P(t_2 | t_1) = count(t_1, t_2) / count(t_1)`

Ví dụ, nếu trong corpus nhãn `N` xuất hiện 1000 lần và trong đó từ "bài" đi kèm nhãn `N` là 12 lần, thì `P(bài | N) = 12 / 1000 = 0.012`.

Có một cái bẫy kinh điển ở đây: nếu một từ chưa từng xuất hiện với nhãn nào đó, xác suất phát xạ sẽ bằng 0, và vì cả chuỗi là một tích, chỉ một số 0 duy nhất sẽ giết chết toàn bộ đường đi. Đây là vấn đề **từ chưa gặp (out-of-vocabulary)** và **thưa dữ liệu (data sparsity)**. Cách xử lý phổ biến là **làm mượt (smoothing)**, đơn giản nhất là **add-one smoothing (Laplace)**: cộng một lượng nhỏ vào mọi tần suất để không xác suất nào tuyệt đối bằng 0. Trong code phía dưới mình dùng một hằng số nhỏ cho từ chưa gặp.

# Vì sao cần Viterbi, không thể brute force?

Giả sử có `T` nhãn khác nhau và câu dài `n` từ. Số chuỗi nhãn khả dĩ là `T^n`. Với `T = 15` nhãn và câu 20 từ, con số đó đã là `15^20`, lớn hơn số nguyên tử ta muốn đếm trong một buổi chiều. Không thể duyệt hết.

**Thuật toán Viterbi** giải bài toán này bằng **quy hoạch động (dynamic programming)**. Nhận xét mấu chốt: đường đi tốt nhất kết thúc ở nhãn `t` tại vị trí `i` nhất định phải chứa đường đi tốt nhất kết thúc ở một nhãn nào đó tại vị trí `i-1`. Nói cách khác, ta không cần nhớ mọi đường, chỉ cần nhớ với mỗi (vị trí, nhãn) thì xác suất của đường tốt nhất dẫn tới đó là bao nhiêu, và nó tới từ nhãn nào.

Ta định nghĩa `V[i][t]` là xác suất của chuỗi tốt nhất kết thúc bằng nhãn `t` tại từ thứ `i`. Công thức truy hồi:

`V[i][t] = max over t' của ( V[i-1][t'] · P(t | t') ) · P(w_i | t)`

Song song với `V`, ta lưu một bảng `backpointer` để nhớ nhãn `t'` nào đã cho giá trị max, phục vụ việc lần ngược **(backtracking)** ra chuỗi cuối. Độ phức tạp giảm từ `T^n` xuống còn `O(n · T^2)`: tuyến tính theo độ dài câu, bình phương theo số nhãn. Đó là toàn bộ phép màu.

Một chi tiết kỹ thuật đáng nói: nhân nhiều xác suất nhỏ với nhau sẽ dẫn tới **tràn số dưới (underflow)**, số bé tới mức máy tính làm tròn thành 0. Cách chuẩn là làm việc trong không gian **log**: thay tích bằng tổng các `log`, thay `max` của tích bằng `max` của tổng. Kết quả `argmax` không đổi vì `log` là hàm đơn điệu tăng. Code dưới đây dùng log để an toàn.

# Cài đặt cho tiếng Việt

Dưới đây là một bộ gán nhãn HMM bigram hoàn chỉnh bằng Python thuần, không phụ thuộc thư viện ngoài. Mình để corpus huấn luyện nhỏ ngay trong code để bài tự chạy được, còn trong thực tế bạn sẽ nạp một corpus lớn như **VLSP** hoặc **Vietnamese Treebank**.

```python
import math
from collections import defaultdict, Counter

# Corpus mẫu: mỗi câu là danh sách (từ_đã_tách, nhãn).
# N: danh từ, V: động từ, A: tính từ, P: đại từ, E: giới từ.
train = [
    [("học_sinh", "N"), ("học", "V"), ("bài", "N")],
    [("tôi", "P"), ("học", "V"), ("tiếng_Việt", "N")],
    [("bài", "N"), ("này", "P"), ("khó", "A")],
    [("cô_giáo", "N"), ("giảng", "V"), ("bài", "N")],
    [("tôi", "P"), ("đọc", "V"), ("sách", "N"), ("hay", "A")],
    [("học_sinh", "N"), ("đọc", "V"), ("sách", "N"), ("ở", "E"), ("trường", "N")],
]

START = "<s>"

def train_hmm(data):
    trans = defaultdict(Counter)   # trans[t_prev][t] = đếm chuyển
    emit = defaultdict(Counter)    # emit[t][w]      = đếm phát xạ
    tag_count = Counter()
    for sent in data:
        prev = START
        for word, tag in sent:
            trans[prev][tag] += 1
            emit[tag][word] += 1
            tag_count[tag] += 1
            prev = tag
    return trans, emit, tag_count

trans, emit, tag_count = train_hmm(train)
TAGS = list(tag_count.keys())
```

Phần quan trọng là hai hàm xác suất, có làm mượt. Ta cho từ chưa gặp một xác suất phát xạ nhỏ nhưng khác 0, để nó không tự động bị loại.

```python
UNK_EMIT = 1e-6  # xác suất phát xạ cho từ ngoài từ vựng

def log_emit(tag, word):
    total = tag_count[tag]
    c = emit[tag][word]
    if c == 0:
        return math.log(UNK_EMIT)
    return math.log(c / total)

def log_trans(prev, tag):
    total = sum(trans[prev].values())
    c = trans[prev][tag]
    # add-one smoothing cho xác suất chuyển
    return math.log((c + 1) / (total + len(TAGS)))
```

Và đây là trái tim của bài, thuật toán Viterbi trong không gian log:

```python
def viterbi(sentence):
    n = len(sentence)
    V = [{} for _ in range(n)]
    back = [{} for _ in range(n)]

    # Bước khởi tạo: từ đầu tiên, nhãn chuyển từ START.
    for t in TAGS:
        V[0][t] = log_trans(START, t) + log_emit(t, sentence[0])
        back[0][t] = START

    # Bước truy hồi.
    for i in range(1, n):
        for t in TAGS:
            best_prev, best_score = None, float("-inf")
            for t_prev in TAGS:
                score = V[i - 1][t_prev] + log_trans(t_prev, t)
                if score > best_score:
                    best_score, best_prev = score, t_prev
            V[i][t] = best_score + log_emit(t, sentence[i])
            back[i][t] = best_prev

    # Lần ngược: tìm nhãn cuối tốt nhất rồi đi lùi.
    last_tag = max(V[n - 1], key=V[n - 1].get)
    tags = [last_tag]
    for i in range(n - 1, 0, -1):
        last_tag = back[i][last_tag]
        tags.append(last_tag)
    tags.reverse()
    return list(zip(sentence, tags))

print(viterbi(["học_sinh", "học", "bài"]))
print(viterbi(["tôi", "đọc", "sách"]))
```

Kết quả in ra sẽ là:

```
[('học_sinh', 'N'), ('học', 'V'), ('bài', 'N')]
[('tôi', 'P'), ('đọc', 'V'), ('sách', 'N')]
```

Chú ý câu đầu: từ "học" được gán đúng là động từ `V` chứ không phải danh từ, mặc dù nó nằm giữa hai danh từ. Lý do là xác suất chuyển `P(V | N)` và `P(N | V)` trong corpus mẫu ủng hộ mẫu hình danh từ, động từ, danh từ hơn là ba danh từ liên tiếp. Đó chính là ngữ cảnh mà mô hình đã học được, chỉ từ việc đếm.

# Những chỗ mô hình này còn yếu

Mình muốn thành thật về giới hạn, vì HMM bigram tuy đẹp về mặt sư phạm nhưng còn cách khá xa các bộ gán nhãn hiện đại.

Thứ nhất, **cửa sổ ngữ cảnh quá hẹp**. Bigram chỉ nhìn một nhãn lùi. Nâng lên **trigram** (nhìn hai nhãn) thường cải thiện độ chính xác nhưng làm dữ liệu thưa hơn, đòi hỏi smoothing tinh vi hơn như back-off hay nội suy tuyến tính.

Thứ hai, **HMM không nhìn được đặc trưng bên trong từ**. Một mô hình phân biệt **(discriminative)** như **Conditional Random Field (CRF)** có thể dùng đặc trưng như từ có viết hoa không, hậu tố là gì, từ đứng sau là gì, thứ mà HMM sinh tính **(generative)** không nắm bắt tự nhiên. Với tiếng Việt, thông tin như "từ láy", "từ Hán Việt", hay từ lân cận thường rất có giá trị.

Thứ ba, và đây là điều thực tế nhất: các bộ gán nhãn tốt nhất hiện nay dựa trên biểu diễn ngữ cảnh sâu, kiểu **BiLSTM-CRF** hay các mô hình nền **Transformer** như **PhoBERT** cho tiếng Việt. Chúng học được biểu diễn từ theo ngữ cảnh hai chiều, vượt xa giả định Markov một bậc.

Vậy học HMM để làm gì khi đã có Transformer? Mình nghĩ giá trị của nó không nằm ở việc đem đi triển khai, mà ở chỗ nó là mô hình chuỗi tối giản mà bạn có thể hiểu trọn vẹn từ đầu tới cuối. Viterbi không biến mất khi ta lên BiLSTM-CRF: tầng giải mã của CRF vẫn dùng đúng thuật toán quy hoạch động đó để tìm chuỗi nhãn tối ưu. Nắm chắc HMM và Viterbi là nắm chắc cái xương sống mà rất nhiều mô hình chuỗi phức tạp hơn vẫn đang dựa vào. Còn chuyện nó có phải công cụ mình chọn cho một dự án thật hay không, thành thật mà nói, còn tùy dữ liệu và ràng buộc, và mình không nghĩ có một câu trả lời gọn gàng cho mọi trường hợp.

# Tài liệu tham khảo

- Daniel Jurafsky, James H. Martin, *Speech and Language Processing*, chương về HMM và POS tagging (bản nháp chương 3 phiên bản 3 có công khai trên trang của tác giả tại Stanford).
- L. R. Rabiner, "A Tutorial on Hidden Markov Models and Selected Applications in Speech Recognition", *Proceedings of the IEEE*, 1989.
- A. J. Viterbi, "Error bounds for convolutional codes and an asymptotically optimum decoding algorithm", *IEEE Transactions on Information Theory*, 1967.
- Christopher Manning, Hinrich Schütze, *Foundations of Statistical Natural Language Processing*, MIT Press.
- Dat Quoc Nguyen và cộng sự, "PhoBERT: Pre-trained language models for Vietnamese", Findings of EMNLP 2020.
- Trang dự án VLSP (Vietnamese Language and Speech Processing) về các bộ ngữ liệu và nhãn từ loại tiếng Việt.

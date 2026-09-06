---
title: Đọc bản tin METAR và TAF
excerpt: "Biến lý thuyết weather-minima thành thói quen thực dụng cho phi công sim."
permalink: /topics/doc-ban-tin-metar-va-taf/
categories:
  - topics
  - aviation
date: 2026-02-13 09:00
---


## METAR là gì?

Về lý thuyết, **METAR** (viết tắt của **Meteorological Aerodrome Report**) là một bản tin quan trắc thời tiết thực tế tại một sân bay, phát ra theo chu kỳ, thường là mỗi 30 phút hoặc mỗi 60 phút. Chữ "aerodrome" trong tên gọi nói lên tất cả: đây là ảnh chụp thời tiết ngay tại sân bay ở thời điểm quan trắc, chứ không phải dự báo. Nếu METAR nói gió đang 18 knot thì đó là gió người ta vừa đo được, không phải gió người ta nghĩ sẽ có.

Đi kèm với METAR gần như luôn có **TAF** (viết tắt của **Terminal Aerodrome Forecast**). Đây mới là bản **dự báo**, thường phủ một khoảng thời gian dài, phổ biến là 24 hoặc 30 giờ, và tập trung vào vùng trời quanh sân bay (bán kính khoảng 5 hải lý theo quy ước của **ICAO**). Cặp METAR và TAF là hai thứ đầu tiên mà một phi công thật đọc trước khi lên kế hoạch bay, và với chúng ta, những người bay sim, nó cũng nên là bước đầu tiên trước khi bấm nút "ready to fly".

Điểm dễ nhầm nhất khi mới học: METAR trả lời câu hỏi "bây giờ trời thế nào?", còn TAF trả lời "trong vài giờ tới trời sẽ ra sao?". Đọc nhầm hai cái này là nguồn gốc của rất nhiều quyết định sai.

## Lịch sử một chút

Định dạng mã hóa mà chúng ta đọc ngày nay không rơi từ trên trời xuống. Nó là kết quả của việc **ICAO** và **WMO** (**World Meteorological Organization**) chuẩn hóa cách các quốc gia trao đổi tin thời tiết hàng không, để một phi công Nhật có thể đọc bản tin của một sân bay Pháp mà không cần biết tiếng Pháp. Bản tin được thiết kế để ngắn, truyền qua đường teletype băng thông thấp ngày xưa, nên mọi thứ đều được viết tắt tới mức tối đa. Đó là lý do nó trông như một dòng ký tự khó hiểu với người mới, nhưng lại cực kỳ đặc (dense) với người quen.

Có một khác biệt nhỏ hay gây bối rối: Mỹ dùng một biến thể riêng cho một vài quy ước (ví dụ đơn vị và cách ghi tầm nhìn), còn phần lớn thế giới theo chuẩn ICAO. Trong sim, tùy add-on thời tiết bạn dùng mà bản tin sẽ nghiêng về kiểu nào.

## Giải phẫu một bản METAR

Cách tốt nhất để học là mổ xẻ một ví dụ. Đây là một METAR mẫu (đúng định dạng chuẩn, số liệu minh họa):

```
METAR VVTS 130700Z 18008KT 9999 FEW018 SCT025 32/24 Q1010 NOSIG
```

Ta đọc từng khối một:

1. **VVTS**: mã sân bay theo chuẩn **ICAO** 4 ký tự (ở đây là Tân Sơn Nhất). Đừng nhầm với mã **IATA** 3 ký tự (SGN) hay dùng trên vé máy bay.
2. **130700Z**: thời điểm quan trắc. Ngày 13, lúc 07:00, chữ **Z** nghĩa là giờ **Zulu**, tức **UTC**. Đây là điểm sống còn: mọi giờ trong hàng không là UTC, không phải giờ địa phương. Bay sim mà quy đổi nhầm múi giờ là tự đưa mình vào ban đêm khi tưởng đang giữa trưa.
3. **18008KT**: gió. Hướng gió **180** độ (so với hướng bắc thật), tốc độ **08** knot **(KT)**. Nếu có giật, nó viết dạng `18008G20KT` (gió giật tới 20 knot). Chuỗi `VRB` nghĩa là hướng gió biến thiên, thường khi gió nhẹ.
4. **9999**: tầm nhìn **(m)**. `9999` là quy ước cho "từ 10 km trở lên". Nếu ghi `0800` thì tầm nhìn chỉ còn 800 mét, một con số đáng lo.
5. **FEW018 SCT025**: mây. Đây là phần đáng học kỹ nhất, sẽ nói ở dưới.
6. **32/24**: nhiệt độ **32** độ C trên **điểm sương (dew point)** **24** độ C. Khoảng cách giữa hai số này (spread) càng nhỏ thì khả năng có sương mù hoặc mây thấp càng cao.
7. **Q1010**: áp suất quy về mực nước biển, **QNH**, tính bằng **hectopascal (hPa)**. Mỹ hay ghi dạng `A2992` (inches of mercury). Đây là số bạn set vào altimeter để đọc đúng độ cao.
8. **NOSIG**: "no significant change", không có thay đổi đáng kể được dự báo trong 2 giờ tới.

### Đọc lớp mây cho đúng

Phần mây gồm một mã ba chữ chỉ độ phủ, cộng ba số chỉ độ cao chân mây tính theo trăm feet trên mặt sân (**AGL**, above ground level). Bốn mức phủ chính, theo số **okta** (phần tám bầu trời bị mây che):

1. **SKC** hoặc **CLR**: trời quang.
2. **FEW**: ít mây, 1 tới 2 okta.
3. **SCT** (**scattered**): rải rác, 3 tới 4 okta.
4. **BKN** (**broken**): mây vỡ, 5 tới 7 okta.
5. **OVC** (**overcast**): u ám, phủ kín 8 okta.

Ví dụ `SCT025` nghĩa là mây rải rác ở 2500 feet AGL. Con số quan trọng với phi công là **ceiling**, tức trần mây, được định nghĩa là chân của lớp mây thấp nhất đạt từ **BKN** trở lên. `FEW` và `SCT` không tạo ceiling; chỉ `BKN` và `OVC` mới tính. Đây là chi tiết mà rất nhiều người bay sim đọc lướt qua và hiểu sai.

Ngoài ra bạn sẽ gặp `CB` (cumulonimbus, mây dông) hay `TCU` (towering cumulus) dán vào cuối một lớp mây, ví dụ `SCT018CB`. Thấy `CB` là thấy khả năng dông, gió giật mạnh, và turbulence. Trong sim, đó là lúc nên cân nhắc lại đường bay.

## TAF khác METAR ở đâu

TAF trông giống METAR nhưng có thêm các từ khóa chỉ diễn biến theo thời gian. Một ví dụ minh họa:

```
TAF VVTS 130500Z 1306/1406 16010KT 9999 SCT020
  TEMPO 1308/1312 4000 TSRA SCT015CB
  BECMG 1318/1320 09006KT
```

Cách đọc:

1. **1306/1406**: khoảng hiệu lực của dự báo, từ ngày 13 lúc 06Z tới ngày 14 lúc 06Z.
2. Dòng đầu là điều kiện **thịnh hành (prevailing)** dự kiến.
3. **TEMPO 1308/1312**: những biến động **tạm thời**, kéo dài dưới một giờ mỗi lần, xảy ra trong cửa sổ 08Z tới 12Z. Ở đây là tầm nhìn tụt xuống 4000 m kèm **TSRA** (thunderstorm with rain, dông kèm mưa) và mây `CB`.
4. **BECMG 1318/1320**: **becoming**, một thay đổi **dần và bền vững** sẽ hoàn tất trong cửa sổ 18Z tới 20Z. Sau đó gió chuyển sang 090 độ, 6 knot.

Ngoài ra còn có **FM** (**from**, thay đổi nhanh và dứt khoát tại một mốc giờ) và **PROB30 / PROB40** (xác suất 30 hoặc 40 phần trăm xảy ra một kịch bản). Điểm cần nhớ: `TEMPO` là chớp nhoáng và có thể lặp lại, còn `BECMG` là chuyển trạng thái một chiều. Lập kế hoạch dựa vào hai từ này rất khác nhau.

## Weather minima: biến lý thuyết thành thực dụng

Đây là phần mà mình muốn nhấn mạnh cho anh em bay sim. Đọc được bản tin mới chỉ là một nửa. Nửa còn lại là biết con số đó có ý nghĩa gì với chuyến bay của bạn. Khái niệm trung tâm là **weather minima**: ngưỡng thời tiết tối thiểu để một loại tiếp cận (approach) hay một loại phép bay được phép thực hiện.

Hai con số cốt lõi trong minima là **ceiling** và **visibility**. Chúng quyết định bạn đang ở trong điều kiện **VMC** (**Visual Meteorological Conditions**, bay bằng mắt) hay **IMC** (**Instrument Meteorological Conditions**, buộc phải bay bằng thiết bị). Ranh giới giữa chúng, tức **VFR** so với **IFR**, tùy vùng trời nhưng một quy ước phổ biến ở mức thấp là: trần mây dưới 1000 feet hoặc tầm nhìn dưới 5 km thì coi như không còn đủ điều kiện VFR.

Cách mình biến điều này thành thói quen thực dụng trước mỗi chuyến sim, theo đúng thứ tự:

1. **Đọc QNH trước tiên** và set ngay vào altimeter. Sai bước này là sai toàn bộ độ cao, nguy hiểm nhất khi tiếp cận.
2. **So ceiling với minima của approach** bạn định bay. Một **ILS CAT I** điển hình có **decision height** quanh mức 200 feet và cần tầm nhìn (hay **RVR**, runway visual range) tối thiểu vài trăm mét. Nếu ceiling trong METAR thấp hơn decision height, bạn gần như chắc chắn sẽ phải **go-around**. Biết trước điều đó thì không bị bất ngờ.
3. **Đọc gió so với hướng đường băng**. Tách gió thành **headwind** (thành phần dọc) và **crosswind** (thành phần ngang). Crosswind vượt giới hạn của tàu bay là lý do chính đáng để đổi đường băng hoặc đổi sân bay. Một phép nhẩm nhanh: gió lệch 30 độ so với trục đường băng thì crosswind xấp xỉ một nửa tốc độ gió; lệch 60 độ thì gần bằng toàn bộ tốc độ gió.
4. **Nhìn spread nhiệt độ và điểm sương**. `32/24` là an toàn, nhưng `12/12` (spread bằng 0) là tín hiệu sương mù, và sương mù nuốt tầm nhìn nhanh hơn bạn tưởng.
5. **Đọc TAF để chọn thời điểm và sân bay dự bị (alternate)**. Nếu TAF có `TEMPO ... TSRA` đúng vào giờ bạn hạ cánh, hãy chuẩn bị tinh thần hoặc dời giờ. Chọn alternate cũng dựa trên cùng logic minima, chỉ khác là áp cho sân bay thứ hai.

Cái hay của cách làm này là nó biến một dòng ký tự khô khan thành một chuỗi quyết định cụ thể: set altimeter bao nhiêu, dùng đường băng nào, có cần alternate không, và có nên bay ở khung giờ này không. Đó chính là chỗ mà lý thuyết weather minima trở nên thực dụng.

## Vài lời kết, hơi mở

Thành thật mà nói, không có một bộ minima "đúng" duy nhất cho mọi người bay sim. Phi công thật bị ràng buộc bởi minima của hãng, của tàu bay, của cơ trưởng, và của cơ quan quản lý bay. Chúng ta bay sim thì tự do hơn, và đó vừa là điểm sướng vừa là cái bẫy: dễ tặc lưỡi bay vào điều kiện mà ngoài đời sẽ bị hủy chuyến. Mình không cho rằng lúc nào cũng phải bay đúng như quy định thật, thỉnh thoảng lao vào một cơn dông trong sim để tập tay lái cũng là một cách học. Nhưng biết chính xác mình đang phá luật nào, và tại sao luật đó tồn tại, thì khác hẳn với việc mù mờ bấm nút cất cánh.

Nếu bạn chỉ nhớ được một điều từ bài này, hãy nhớ thói quen nhỏ: mở METAR và TAF, đọc QNH, đọc ceiling, đọc gió, rồi mới quyết định. Chừng đó thôi đã tách một chuyến bay có kế hoạch khỏi một chuyến bay may rủi.

## Tài liệu tham khảo

- ICAO, *Annex 3 to the Convention on International Civil Aviation: Meteorological Service for International Air Navigation*.
- WMO, *Manual on Codes (WMO-No. 306), Volume I.1*, phần định nghĩa mã METAR, SPECI và TAF.
- FAA, *Aviation Weather Handbook (FAA-H-8083-28)*.
- SKYbrary, các mục "METAR", "TAF" và "Aerodrome Operating Minima".
- Wikipedia, các bài "METAR" và "Terminal aerodrome forecast".

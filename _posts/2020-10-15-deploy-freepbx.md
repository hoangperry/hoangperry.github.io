---
title: Xây dưng một tổng đài VoIP
excerpt: xây dựng một tổng đài cho vui
permalink: /topics/freepbx/
background-image: topic_image/freepbx/back.png
categories:
  - topics
date: 2020-10-15 11:11
---


# Xây dụng tổng đài VoIP với FreePBX và Asterisk

Việc cấu hình Asterisk trên server bằn gthao tác thủ công trên từng file cấu hình sẽ làm mất rất nhiều thời gian và dễ gây sai sót. 

Vì vậy FreePBX ra đời để giúp quản lí Asterisk trên giao diện đồ hoạ. Việc cấu hình sẽ dễ dàng hơn rất nhiều vì FreePBX xây dựng cơ sở dữ liệu cho những thông tin cấu hình Assterisk. Bên cạnh đó FreePBX cũng giúp sao lưu những thông tin cấu hình để chúng ta có thể khôi phục hệ thống nỗi có lỗi cấu hình xảy ra. 

## Cài đặt hệ thống

Để cài đặt một hệ thống tổng đài, chúng ta sẽ cần rất nhiều dịch vụ để có thể vận hành cũng như là đảm bảo tính bảo mật của hệ thống. Trước tiên chúng ta sẽ cần Asterísk để xây dựng tổng đài IP. Tiếp theo chúng ta sẽ dùng FreePBX để quản lý và cấu hình Asterisk. Để có thể vận hành được FreePBX chúng ta sẽ cần cài đặt thêm NodeJS, MariaDB (hoặc MySQL) và Fail2Ban để ngăn chặn việc tấn công brute force. Bên cạnh đó chúng ta cũng sẽ setup một DB dự phòng để backup cấu hình trên MariaDB về đó và sao lưu khi cần thiết.

Ở đây để thuận lợi cho việc cài đặt nhiều dịch vụ như đã liệt kê ở trên, chúng ta sẽ dùng công nghệ ảo hoá Docker để triển khai hệ thống. Cụ thể chúng ta sẽ dựng lên 3 container môi container sẽ đảm nhiệm vai trò riêng trong hệ thống, cụ thể như sau: 

- Application: Đây là container mà chúng ta sẽ triển khai FreePBX, Asterisk và cũng như các dịch vụ cần thiết khác của FreePBX

- MariaDB: Database nơi lưu trữ cấu hình cho FreepPBX

- BackupDB: Database backup cho MariaDB

Tất cả những môi trường, cấu hình, run script của từng ứng dụng chúng ta sẽ viết trong Dockerfile và sau đó định nghĩa lại những ứng dụng trong Docker-compose. Việc chạy tất cả trong Docker-compose giúp chúng ta tạo mội trường biệt lập để dễ dàng quản lý những ứng dụng này.


{% include post_picwrap.html pos="fit" src="/images/topic_image/freepbx/docker.png" %}

## Cấu hình

Sau khi cài đặt FreePBX và các dịch vụ cần thiết của nó. Chúng ta sẽ truy cập vào trang admin để tiến hành cấu hình hệ thống ở địa chỉ sau **localhost/admin**.
Lần đầu tiền chúng ta đăng nhập vào hệ thống. FreePBX sẽ bắt chúng ta khởi tạo tài khoản admin.

{% include post_picwrap.html pos="fit" src="/images/topic_image/freepbx/1.png" %}

Sau khi tạo tài khoản admin thì chúng ta sẽ đăng nhập bằng username password vừa tạo để truy cập vào trang quản lý của FreePBX.

{% include post_picwrap.html pos="fit" src="/images/topic_image/freepbx/2.png" %}

Thiết ngày ngày giờ, múi giờ

{% include post_picwrap.html pos="fit" src="/images/topic_image/freepbx/3.png" %}


Đầu tiên chúng sẽ cần tạo số máy nhánh. Ở đây chúng ta dùng giao thức SIP. Để tạo số máy nhanh trên giao thức SIP, chúng ta truy cập vào applications/extensions. Sau đó chọn add extension để tạo số máy nhánh. 


{% include post_picwrap.html pos="fit" src="/images/topic_image/freepbx/4.png" %}

Ở đây, chúng ta chỉ quan tâm đến "User Extension" là số máy nhánh và "Secret" là password cho phía client. "Display Name" là tên hiển thị của người dùng khi gọi vào một số máy nhánh khác. "Outbound CID" và "Emergency CID" là số sẽ được ghi đè lên số máy nhánh khi số này này gọi ra ngoài hoặc thực hiện cuộc gọi khẩn cấp.

Vì mặc định FreePBX sẽ ánh xạ mỗi số máy nhánh với một người dùng trên cơ sở dữ liệu của nó. Nhưng FreePBX vẫn hỗ trợ chúng ta không ánh xạ số máy nhánh với bất kì người dùng nào hêt. Nhưng nếu không có người dùng thì việc quản lý số máy nhánh sẽ rất khó khăn, việc quản lý ở đây đó là quản lý cuộc gọi hoặc những tính năng cài thêm của FreePBX. 

Trong trường hợp này chúng ta sẽ tạo một người dùng mới cho số máy nhánh. ở trường "Password For New User" là password để người dùng sẽ khởi tạo. Mặc định username của người dùng này sẽ là số máy nhánh, chúng ta vẫn có thể đổi sáng một username theo ý muốn ở đây. 

Sau khi thiếp lập xong những số máy nhánh cần thiết, chúng ta sang phần settings/asterisk SIP settings để cấu hình máy chủ SIP của Asterisk. Ở đây FreePBX đã hỗ trợ sẵn rất nhiều tính năng cho chúng ta trên Asterisk.  


{% include post_picwrap.html pos="fit" src="/images/topic_image/freepbx/5.png" %}

Ở đây chúng ta sẽ chỉ cấu hình lại range port của giao thức RTP để phù hợp với cấu hình mạng máy ảo bên ngoài. 


## Cài đặt tổng đài IVR (Tương tác trả lời tự động)

FreePBX có hỗ trợ cho chúng ta module IVR, nhưng module này chưa được cài sẵn vào IVR mặc định. Vì vậy để cào IVR vào phần quản lý module trong "Module Admin" và tìm kiếm các package online và cài đặt module IVR vào server. 

Sau khi cài đặt xong, IVR nằm trong menu applications của phần quản lý FreePBX. Nhưng trước khi đi đến cài đặt IVR thì chúng ta cần phải chuẩn bị trước các bản thu âm và cấu hình những tệp thu âm này trên FreePBX qua Systems Recordings. Hiện nay, FreePBX cũng có thêm các module text to sppech để việc tạo các bản ghi âm dễ dàng và hiệu quả hơn rất nhiều. Nhưng module này có thể tìm kiếm ở ngoài hoặc trong những package online của FreePBX. 

Sau khi cài đặt xong System Recordings, chúng ta sang IVR để thiết lập tổng đài tự động. Ở đây chúng ta thiết lập "Announcement" là thông báo mà sẽ phát lên khi có người truy cập với IVR này. IVR này chúng ta sẽ chọn thông báo mà chúng ta đã ghi âm và cấu hình ở System Recordings trước đó. Bên dưới của khung cấu hình IVR, chúng ta sẽ có khu vực để thiết lập "IVR entries". Đây là nơi chúng ta cấu hình đích đến của cuộc goi ghi người dùng bấm số tương ứng trên bàn phím. Đích của IVR có thể là một số máy nhánh, IVR khác hoặc những call record có sẵn. Ngoài ra chúng ta còn có thể quyết định việc cuộc gọi có trở về lại IVR hiện tại hay không. 


{% include post_picwrap.html pos="fit" src="/images/topic_image/freepbx/10.png" %}

Sau khi cài đặt xong IVR chúng ta sẽ thiết lập một số máy nhánh cho IVR đã tao. Việc thiết lập số máy nhánh cho IVR cũng tương tự việc thiết lập số máy nhánh cho một người dùng. Chúng ta vào applications/extensions như đã giới thiệu trước đó. Ở đây chúng ta sẽ tạo một Virtual Extensions. Sau đó, chúng ta sang phần thiết lập nâng cao. Ở đây chúng ta sẽ cài đặt "Optional Destinations" mục "Not Reachable" về IVR mà chúng ta muốn định hướng cuộc gợi tới.


{% include post_picwrap.html pos="fit" src="/images/topic_image/freepbx/11.png" %}

## Thực hiện cuộc gọi


Để có thể kết nối với Asterisk đã cấu hình ở trên, chúng ta cần một SIP client. SIP client này chúng ta có thể dùng bất kì client nào, nhưng trong trường hơp này chúng ta sẽ dùng Zoiper để làm SIP client kết nối với Asterisk. Hiện nay, Zoiper đã hỗ trợ rất nhiều hệ điều hành trên nhiều nên tảng khác nhau. 

Sau khi tải và cài đặt Zoiper, mở Zoiper lên chúng ta sẽ có giao hiện như sau.

{% include post_picwrap.html pos="fit" src="/images/topic_image/freepbx/6.png" %}

Theo mặc định Zoiper sẽ đăng ký với Asterisk qua cổng 5060. Nhưng vì chúng ta sử dụng giao thức CHAN_SIP nên mặc định cổng đăng kí trên Asterisk sẽ là 5160. Vì vậy chúng ta cần set thêm số cổng ở sau địa chỉ IP của Asterisk trên Zoiper


{% include post_picwrap.html pos="fit" src="/images/topic_image/freepbx/7.png" %}

Khi mọi thứ đều được cấu hình đúng chúng ta sẽ thấy Zoiper thông báo kết nối SIP với giap thức UDP. 

{% include post_picwrap.html pos="fit" src="/images/topic_image/freepbx/8.png" %}

Chúng ta sẽ đăng nhập vào Zoiper trên 1 máy khác cùng mặng với máy host hoặc máy host phải có Static ra Internet. 2 máy này phải đăng nhập vào 2 đầu số khác nhau đã được đăng ký trước đó. Ở đây, chúng ta sử dụng thêm một điện thoại để kết nối với Asterisk. Khi máy A gọi tới máy B, máy B sẽ hiện lên thông báo đổ chuông và 2 hai sẽ thiết lập kết nối khi máy B chấp nhận cuộc gọi của máy A. 


Khi hai máy kết nối thành công, hai bên đều hiển thị thông số các packet gửi đi và nhận vào như hình bên dưới.

{% include post_picwrap.html pos="fit" src="/images/topic_image/freepbx/9.png" %}


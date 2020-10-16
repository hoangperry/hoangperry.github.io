---
title: Deploy FreePBX
excerpt: "FreePBX"
permalink: /topics/freepbx/
background-image: topic_image/milvus/back.png
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


## Cấu hình

Sau khi cài đặt FreePBX và các dịch vụ cần thiết của nó. Chúng ta sẽ truy cập vào trang admin để tiến hành cấu hình hệ thống ở địa chỉ sau **localhost/admin**.
Lần đầu tiền chúng ta đăng nhập vào hệ thống. FreePBX sẽ bắt chúng ta khởi tạo tài khoản admin.

{% include post_picwrap.html pos="right" src="/images/topic_image/freepbx/1.png" %}

Sau khi tạo tài khoản admin thì chúng ta sẽ đăng nhập bằng username password vừa tạo để truy cập vào trang quản lý của FreePBX.

{% include post_picwrap.html pos="right" src="/images/topic_image/freepbx/2.png" %}

Thiết ngày ngày giờ, múi giờ

{% include post_picwrap.html pos="fit" src="/images/topic_image/freepbx/3.png" %}



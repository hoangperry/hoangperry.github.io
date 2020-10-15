---
title: Deploy FreePBX
excerpt: "FreePBX"
permalink: /topics/freepbx/
background-image: topic_image/milvus/back.png
categories:
  - topics
date: 2020-10-16 11:11
---


# Xây dụng tổng đài VoIP với FreePBX và Asterisk

Việc cấu hình Asterisk trên server bằn gthao tác thủ công trên từng file cấu hình sẽ làm mất rất nhiều thời gian và dễ gây sai sót. 

Vì vậy FreePBX ra đời để giúp quản lí Asterisk trên giao diện đồ hoạ. Việc cấu hình sẽ dễ dàng hơn rất nhiều vì FreePBX xây dựng cơ sở dữ liệu cho những thông tin cấu hình Assterisk. Bên cạnh đó FreePBX cũng giúp sao lưu những thông tin cấu hình để chúng ta có thể khôi phục hệ thống nỗi có lỗi cấu hình xảy ra. 

Để việc triển khai FreePBX dễ dàng hơn thì chúng ta sẽ triển khai phần mềm FreePBX công nghệ ảo hoá Docker. 


## Chuẩn bị môi trường cài đặt

Để cài đặt một hệ thống tổng đài, chúng ta sẽ cần rất nhiều dịch vụ để có thể vận hành cũng như là đảm bảo tính bảo mật của hệ thống. Trước tiên chúng ta sẽ cần Asterísk để xây dựng tổng đài IP. Tiếp theo chúng ta sẽ dùng FreePBX để quản lý và cấu hình Asterisk. Để có thể vận hành được FreePBX chúng ta sẽ cần cài đặt thêm NodeJS, MariaDB (hoặc MySQL) và Fail2Ban để ngăn chặn việc tấn công brute force. 

Ở đây để thuận lợi cho việc cài đặt chúng ta sẽ dùng công nghệ ảo hoá Docker để triển khai hệ thống. 



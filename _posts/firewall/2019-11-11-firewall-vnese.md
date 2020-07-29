---
title: Firewall - Vietnamese
excerpt: All about firewall - Vietnamese.
categories:
  - topics
  - network
date: 2019-11-11 17:40
background-image: topic_image/firewall/firewall.png
layout: page
---

* Tường lửa đóng vai trò rất quan trọng trong việc bảo vệ một hệ thống nội bộ khỏi các mối đe dọa như hacker, worm, hay các loại virus xâm nhập vào máy tính. Ngoài ra tường lửa còn có tác dụng theo dõi, phân tích các luồng thông tin quá mạng và quyết định sẽ làm gì với những luồng thông tin đó. *


## Goals of a firewall: 

1. các gói tin từ bên ngoài vào và đi ra đều phaỉ thông qua tường lửa 
2. Chỉ có các lưu lượng được ủy quyền mới được cho phép đi qua tường lửa. 
3. Tường lửa phải miễn nhiễm với các sự xâm nhập.


# 1. Firewall Characteristics and access policy


Một thành phần quan trọng trong tường lửa là một access control phù hợp. 
Các đặc điểm mà access control của tường lửa có thể sử dụng để lọc lưu lượng:

**IP Address and Protocol Values:**
	Access control dựa trên địa chỉ nguồn, địa chỉ đích, số cổng, hướng của gói tin đi vào hay đi ra và các đặc điểm của tầng mạng(Network layer) và tầng vận chuyển(Transport layer). Kiểu chính sách truy cập này thường dùng để giới hạn quyền truy cập vào các dịch vụ cụ thể. 

**Application Protocol:** 
	Access control dựa trên cơ sở các giao thức dữ liệu ứng dụng được ủy quyền. Kiểu access control này thường được sử dụng ở tầng ứng dụng để chuyển tiếp và giám sát việc trao đổi thông tin cho các giao thức ứng dụng cụ thể. 

**User Identity:**
	Access control dựa trên định danh của người dùng. Thường sử dựng một số hình thức xác thực an toàn như IPSec.  

**Network Activity:** 
	Access control dựa trên các sự cân nhắc về thời gian ví dụ như: chỉ được cho phép trong giờ làm việc của tổ chức. hoặc cân nhắc về tỷ lệ yêu cầu.


# 2. Types of Firewalls

Tường lửa có thể giám sat mạng ở một số cấp độ, từ các gói mạng cấp thấp, riêng lẻ hoặc là một phần của một luồng thông tin cho đến kiểm tra chi tiết các giao thức ứng dụng. Mỗi tầng sẽ có một access control phù hợp khác nhau. Tùy thuộc và loại tường lửa mà nó có thể hoạt động khác nhau. Sau đây là một số loại tường lửa chính: 

* **Packet filtering firewall**

{% include post_picwrap.html pos="fit" src="/images/topic_image/firewall/img_2.png" %}

* **Stateful inspection firewall**


{% include post_picwrap.html pos="fit" src="/images/topic_image/firewall/img_3.png" %}

* **Application proxy firewall**


{% include post_picwrap.html pos="fit" src="/images/topic_image/firewall/img_4.png" %}

* **Circuit-level proxy firewall**


{% include post_picwrap.html pos="fit" src="/images/topic_image/firewall/img_5.png" %}

# 3. Cơ sở tưởng lửa


## 3.1 Bastion Host
Basting host là một hệ thống được xác định bởi người quản trị tường lửa, là một điểm mạnh quan trọng trong bảo mật mạng. Thông thường, Basting host đóng vai trò là nền tảng cho tầng ứng dụng. thường thì các đặc điểm của basting host sẽ như sau: 
	
Chỉ các dịch vụ mà người quản trị viên mạng coi là thiết mới được cài đặt trên basting host ví dụ như: DNS, FTP, HTTP, SMTP,...

Basting host có thể yêu cầu xác thực bổ sung trước khi người dùng được phép truy cập vào các dịch vụ proxy. Ngoài ra mỗi dịch vụ proxy có thể yêu cầu xác thực riêng trước khi cấp quyền truy cập cho người dùng

Mỗi proxy được cấu hình để chỉ hỗ trợ một tập hợp của bộ lệnh tiêu chuẩn.

Mỗi proxy được cấu hình để chỉ cho phép các truy cập vào các hệ thống máy chủ cụ thể. Điều này có nghĩa là các lệnh và các tính năng chỉ có thể được sử dụng trên một phần của hệ thống.

Mỗi proxy duy trì sự kiểm tra chi tiết bằng cách lưu lại tất cả lưu lượng truy cập của từng kết nối và thời lượng của mỗi kết nối. Việc lưu lại các thông tin truy cập này là một điều cần thiết để điều tra và chấm dứt các cuộc tấn công của những kẻ xâm nhập. 

Mỗi module proxy là một gói phần mền rất nhỏ được thiết kế đặc biệt để bảo mật mạng. Do tính đơn giản của nó, việc kiểm tra các lỗi bảo mật sẽ dễ dàng hơn. Ví dụ như một ứng dụng mail trong UNIX có thể chứ hơn 20000 dòng mã, trong khi một proxy mail có thể sẽ ít hơn 1000 dòng. 

Mỗi proxy sẽ độc lập lớp các proxy khác trên bastion host. Nếu có bất kỳ vấn đề với proxy nào thì nó có thể được gỡ ra mà không ảnh hướng tới các proxy khác. Nếu người dùng yêu cầu hỗ trợ một service mới thì quản trị viên mạng có thể dễ dàng cài đặt nó trên bastion host. 

Một proxy thường không được truy cập vào các tài nguyên khác ngoại trừ file cấu hình ban đầu của nó. Do đó các phần file chứa mã có thể thực thi thì chỉ có thể đọc mà thôi. Điều này sẽ gây khó khăn cho những kẻ xâm nhập để cài trojan hoặc các file nguy hiểm các trên bastion host. 

Mỗi proxy chạy như một user không có đặc quyền trên một thư mục riêng và được bảo mật trên bastion host. 


## 3.2 Host-Based Firewalls

Host-based firewall là một modules ứng đụng dùng để bảo vệ các máy chủ riêng lẻ. các modules như vậy thường có sẵn trong hệ điều hành hoặc được cung cấp dưới dạng các package bổ sung. Giống như một tường lửa thông thường, host-resident lọc và hạn chế các luồng dữ liệu. Một số lợi thế khi sử dụng server-based hoặc workstation-based firewall:  


Các quy tắc lọc thông tin có thể tùy chỉnh được cho từng máy chủ. Có thể triển khai các chính sách bảo mật cụ thể cho từng doanh nghiệp với các bộ lọc khác nhau cho từng máy chủ khác nhau. 

Sự bảo vệ được cung cấp độc lập với cấu trúc liên kết. Do đó, các cuộc tấn công từ bên ngoài và cả bên trong đều phải vượt qua tường lửa. 

Được sử dụng cùng lúc với tường lửa độc lập, host-based firewall cung cấp thêm một lớp bảo vệ. Một máy chủ mới có thể kết nối với mạng mà không cần thay đổi cấu hình của tường lửa mạng.  

## 3.3 Personal Firewall

Personal firewall kiểm soát các lưu lượng thông tin của một máy tính cá nhân hoặc một máy trạm ở phí người dùng. 
Personal firewall có thể dùng ở nhà hoặc các mạng nội bộ của công ty. Thông thường, personal firewall là một ứng dụng trên máy tính cá nhân. Trong trường hợp có nhiều máy tính kết nối với Internet tường lửa có thể đặt trong router. 

Personal firewall thường phức tạp hơn rất nhiều so với server-based firewalls hay tường lửa độc lập. Vai trò chính của tường lửa cá nhân là từ chối truy cập trái phép vào máy tính. Tường lửa cũng có thể giám sát hoạt động dò quét hoặc phát hiện các malware. 

# reference 

Stallings, W., & Brown, L. (2015). Computer Security Principles and Practice (3rd Edition).

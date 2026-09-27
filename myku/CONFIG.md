# ตั้งค่า MySQL แบบง่าย

แก้ไฟล์นี้ไฟล์เดียว:

```text
api/config.php
```

ค่าปกติสำหรับ XAMPP:

```php
'host' => '127.0.0.1',
'database' => 'ku_room_reserve',
'username' => 'root',
'password' => '',
'session_idle_timeout' => 1800,
'allowed_origins' => [],
```

`session_idle_timeout` คือเวลาที่ไม่มีการใช้งาน (วินาที) ค่าเริ่มต้น 1800 = 30 นาที ทุกครั้งที่เรียก API แบบล็อกอินอยู่ ระบบจะเลื่อนเวลาให้อัตโนมัติ ถ้าเกินเวลานี้จะต้องเข้าสู่ระบบใหม่

ถ้า MySQL ของคุณมีรหัสผ่าน ให้ใส่เฉพาะบรรทัด `password` เช่น:

```php
'password' => 'abc123',
```

จากนั้น import `schema.sql` ใน phpMyAdmin แล้วเปิด `http://localhost/myku/` ได้เลย

ห้ามเอา `config.php` ขึ้น Git หรือ Vercel เพราะมีรหัสผ่านฐานข้อมูล ให้ใช้ environment variables `KU_DB_HOST`, `KU_DB_PORT`, `KU_DB_NAME`, `KU_DB_USER`, `KU_DB_PASSWORD`, `KU_SESSION_IDLE_TIMEOUT`, และ `KU_ALLOWED_ORIGINS` บน API hosting แทนเมื่อ deploy จริง

## API สำหรับจัดการห้องของแอดมิน

ทุกคำสั่งต้องใช้ session แอดมิน:

- `GET api/index.php?action=admin-rooms` รายการห้องทั้งที่เปิด/ปิดใช้งาน (ไม่มีรายชื่อแอดมิน)
- `POST ...?action=add-room` เพิ่มห้อง โดยส่ง `building`, `floor`, `room_no`, `room_type`, `capacity`, `features` (array หรือข้อความคั่นด้วย comma), `image_url`, `active`
- `POST ...?action=edit-room` เหมือน add และเพิ่ม `room_id`
- `POST ...?action=delete-room` ส่ง `room_id` เพื่อนำห้องออกจากหน้าสาธารณะ โดยเก็บประวัติการจองไว้
- `POST ...?action=restore-room` ส่ง `room_id` เพื่อเปิดใช้งานห้องอีกครั้ง

รูปภาพใช้ URL หรือพาธไฟล์ที่เว็บเข้าถึงได้ เพื่อให้ทำงานได้ทั้ง XAMPP และ Vercel; ไม่เก็บไฟล์รูปไว้ในฐานข้อมูล

อัปโหลดรูปภาพในหน้าแอดมินรองรับ JPG, PNG และ WebP ขนาดไม่เกิน 5 MB ระบบจะเก็บไฟล์ไว้ที่ `api/uploads/rooms` และบันทึก URL ไว้ในห้อง ใน production ที่ใช้ Vercel ควรเปลี่ยน endpoint นี้ไปใช้ object storage เช่น S3/Cloudinary เพราะ filesystem ของ serverless ไม่ถาวร

หน้าแอดมินแบ่งเป็น 2 แท็บ:
- จัดการห้อง: เพิ่ม แก้ไข ลบ และกู้คืนห้อง
- อนุมัติคำขอ: อนุมัติหรือไม่อนุมัติบัญชีอาจารย์ พร้อม badge จำนวนคำขอปัจจุบัน

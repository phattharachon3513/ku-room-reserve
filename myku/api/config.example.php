<?php
// คัดลอกไฟล์นี้เป็น config.php แล้วแก้ค่าให้ตรงกับ MySQL ของคุณ
return [
  'host' => '127.0.0.1',
  'port' => '3306',
  'database' => 'ku_room_reserve',
  'username' => 'root',
  'password' => 'YOUR_MYSQL_PASSWORD',
  'charset' => 'utf8mb4',
  'allowed_origins' => ['https://YOUR-VERCEL-DOMAIN.vercel.app'],
];

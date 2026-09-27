-- MySQL schema for KU Room Reserve (XAMPP/phpMyAdmin)
CREATE DATABASE IF NOT EXISTS ku_room_reserve CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ku_room_reserve;
CREATE TABLE IF NOT EXISTS users (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(150) NOT NULL, email VARCHAR(190) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, role ENUM('viewer','teacher','admin') NOT NULL DEFAULT 'viewer', status ENUM('pending','active','rejected') NOT NULL DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS buildings (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL UNIQUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS rooms (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, building_id BIGINT UNSIGNED NOT NULL, floor INT NOT NULL, room_no VARCHAR(50) NOT NULL, room_type VARCHAR(80) NOT NULL, capacity INT NOT NULL, features JSON NULL, image_url VARCHAR(500) NULL, active TINYINT(1) NOT NULL DEFAULT 1, FOREIGN KEY(building_id) REFERENCES buildings(id), UNIQUE KEY uq_room(building_id,room_no)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS bookings (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, room_id BIGINT UNSIGNED NOT NULL, teacher_id BIGINT UNSIGNED NOT NULL, booking_date DATE NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL, subject VARCHAR(180) NOT NULL, status ENUM('confirmed','cancelled','expired') NOT NULL DEFAULT 'confirmed', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(room_id) REFERENCES rooms(id), FOREIGN KEY(teacher_id) REFERENCES users(id), INDEX idx_room_date(room_id,booking_date), CONSTRAINT no_overlap UNIQUE(room_id,booking_date,start_time,end_time)) ENGINE=InnoDB;
INSERT IGNORE INTO buildings(name) VALUES ('อาคาร 1'),('อาคาร 2'),('อาคาร 3');
INSERT IGNORE INTO rooms(building_id,floor,room_no,room_type,capacity,features) VALUES (1,1,'101','บรรยาย',120,'["เครื่องเสียง","ไมโครโฟน","โปรเจคเตอร์"]'),(2,2,'204','ปฏิบัติการ',40,'["คอมพิวเตอร์","โปรเจคเตอร์"]'),(3,3,'301','ประชุม',30,'["ทีวี","ไวท์บอร์ด","ไมโครโฟน"]');
-- Optional first admin account. Change the email/password before running in a real environment.
-- Password is ChangeMeNow!2026; remove this row after creating your own admin.
INSERT INTO users(name,email,password_hash,role,status) VALUES ('ระบบผู้ดูแล','admin@ku.th','$2y$10$i0CGE9CQ1rpMAkyYpfRSRu6bQWNKHTAII0CJSqRifLoxKKDZQZgIe','admin','active')
ON DUPLICATE KEY UPDATE email=email;
-- Booking overlap is protected by the API transaction: room row SELECT ... FOR UPDATE, overlap query, then INSERT.

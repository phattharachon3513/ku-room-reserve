<?php
header("Access-Control-Allow-Origin: https://ku-room-reserve.vercel.app");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Credentials: true");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
declare(strict_types=1);

$config = require __DIR__ . '/config.php';
date_default_timezone_set('Asia/Bangkok');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = $config['allowed_origins'] ?? [];
if (is_string($allowedOrigins)) $allowedOrigins = array_filter(array_map('trim', explode(',', $allowedOrigins)));
$localOrigin = (bool)preg_match('/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i', $origin);
if ($origin && (in_array($origin, $allowedOrigins, true) || $localOrigin)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
}
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') { http_response_code(204); exit; }
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>$isHttps,'httponly'=>true,'samesite'=>$isHttps?'None':'Lax']);
session_start();

// Sliding inactivity timeout: every authenticated request refreshes this timestamp.
// Keep the server authoritative; the browser never controls session expiry.
$sessionIdleTimeout = max(300, (int)($config['session_idle_timeout'] ?? 1800));

function respond(array $payload, int $status=200): never { http_response_code($status); echo json_encode($payload, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); exit; }
function fail(string $message, int $status=400, string $code='REQUEST_ERROR'): never { respond(['error'=>$message,'code'=>$code],$status); }
function body(): array { $v=json_decode(file_get_contents('php://input') ?: '', true); return is_array($v)?$v:[]; }
function normalizeFeatures(mixed $raw): array {
    if (is_string($raw)) {
        $decoded=json_decode($raw,true);
        $raw=is_array($decoded) ? $decoded : preg_split('/[,\n]+/', $raw);
    }
    if (!is_array($raw)) return [];
    $out=[];
    foreach ($raw as $value) {
        $value=trim((string)$value);
        if ($value!=='' && mb_strlen($value)<=80 && !in_array($value,$out,true)) $out[]=$value;
        if (count($out)>=20) break;
    }
    return $out;
}
function roomRows(array $rows): array {
    foreach ($rows as &$row) {
        $row['features']=normalizeFeatures($row['features'] ?? []);
        $row['active']=(int)($row['active'] ?? 0);
        if (array_key_exists('taken',$row)) $row['taken']=(int)$row['taken'];
    }
    unset($row);
    return $rows;
}
function roomInput(array $input): array {
    $building=trim((string)($input['building']??''));
    $floor=filter_var($input['floor']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>200]]);
    $roomNo=trim((string)($input['room_no']??''));
    $roomType=trim((string)($input['room_type']??''));
    $capacity=filter_var($input['capacity']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>10000]]);
    if ($building===''||mb_strlen($building)>120||!$floor||$roomNo===''||mb_strlen($roomNo)>50||$roomType===''||mb_strlen($roomType)>80||!$capacity) fail('ข้อมูลห้องไม่ครบถ้วนหรือไม่ถูกต้อง',422,'INVALID_ROOM_DATA');
    $image=trim((string)($input['image_url']??''));
    if (mb_strlen($image)>500) fail('ลิงก์รูปภาพยาวเกินไป',422,'INVALID_IMAGE');
    if ($image!=='' && !preg_match('/^(https?:\/\/|\/|data:image\/)/i',$image)) fail('รูปภาพต้องเป็น URL หรือพาธรูปภาพที่ถูกต้อง',422,'INVALID_IMAGE');
    $active=array_key_exists('active',$input) ? (filter_var($input['active'],FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? false) : true;
    return [$building,(int)$floor,$roomNo,$roomType,(int)$capacity,normalizeFeatures($input['features']??[]),$image,(int)$active];
}

function db(array $c): PDO {
    static $pdo=null; if ($pdo instanceof PDO) return $pdo;
    try { $pdo=new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=%s',$c['host'],$c['port']??'3306',$c['database'],$c['charset']??'utf8mb4'),$c['username'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]); return $pdo; }
    catch(Throwable $e) { error_log('DB connection failed: '.$e->getMessage()); fail('ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาติดต่อผู้ดูแลระบบ',503,'DATABASE_UNAVAILABLE'); }
}
function publicUser(array $u): array { unset($u['password_hash']); return $u; }
function currentUser(PDO $pdo): ?array {
    global $sessionIdleTimeout;
    if (empty($_SESSION['user']['id'])) return null;
    $last = (int)($_SESSION['last_activity'] ?? 0);
    if ($last > 0 && (time() - $last) >= $sessionIdleTimeout) {
        unset($_SESSION['user'], $_SESSION['last_activity']);
        return null;
    }
    $q=$pdo->prepare('SELECT id,name,email,role,status,created_at FROM users WHERE id=? LIMIT 1');
    $q->execute([(int)$_SESSION['user']['id']]);
    $u=$q->fetch();
    if (!$u || $u['status']!=='active') { unset($_SESSION['user'], $_SESSION['last_activity']); return null; }
    $_SESSION['user']=$u;
    $_SESSION['last_activity']=time();
    return $u;
}
function requireUser(PDO $pdo): array { $u=currentUser($pdo); if (!$u) fail('กรุณาเข้าสู่ระบบก่อนดำเนินการ',401,'AUTH_REQUIRED'); return $u; }
function requireAdmin(PDO $pdo): array { $u=requireUser($pdo); if ($u['role']!=='admin') fail('สิทธิ์นี้สำหรับผู้ดูแลระบบเท่านั้น',403,'ADMIN_REQUIRED'); return $u; }
function kuEmail(mixed $email): string { $e=strtolower(trim((string)$email)); if (!filter_var($e,FILTER_VALIDATE_EMAIL)||!str_ends_with($e,'@ku.th')) fail('กรุณาใช้อีเมลมหาวิทยาลัยที่ลงท้ายด้วย @ku.th เช่น user@ku.th',422,'KU_EMAIL_REQUIRED'); return $e; }
function dateValue(mixed $date): string { $d=trim((string)$date); $x=DateTimeImmutable::createFromFormat('!Y-m-d',$d); if (!$x||$x->format('Y-m-d')!==$d) fail('รูปแบบวันที่ไม่ถูกต้อง',422,'INVALID_DATE'); return $d; }
function timeValue(mixed $time): string { $t=trim((string)$time); if (!preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/',$t)) fail('รูปแบบเวลาไม่ถูกต้อง',422,'INVALID_TIME'); return strlen($t)===5?$t.':00':$t; }

$pdo=db($config);
// Count any API activity (including public browsing) as activity for an existing session.
if (!empty($_SESSION['user']['id'])) currentUser($pdo);
$action=trim((string)($_GET['action']??'')); $input=body();
if ($action==='me') { $u=currentUser($pdo); respond(['user'=>$u?publicUser($u):null]); }
if ($action==='logout') { $_SESSION=[]; if (ini_get('session.use_cookies')) { $p=session_get_cookie_params(); setcookie(session_name(),' ',time()-42000,$p['path'],$p['domain']??'',$p['secure'],$p['httponly']); } session_destroy(); respond(['ok'=>true]); }

if ($action==='register') {
    $name=trim((string)($input['name']??'')); $email=kuEmail($input['email']??''); $password=(string)($input['password']??'');
    if (mb_strlen($name)<2||mb_strlen($name)>150) fail('กรุณาระบุชื่อ 2–150 ตัวอักษร',422,'INVALID_NAME'); if (strlen($password)<6) fail('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',422,'WEAK_PASSWORD');
    try { $q=$pdo->prepare("INSERT INTO users(name,email,password_hash,role,status) VALUES(?,?,?,'teacher','pending')"); $q->execute([$name,$email,password_hash($password,PASSWORD_DEFAULT)]); }
    catch(PDOException $e) { if ((int)$e->errorInfo[1]===1062) fail('อีเมลนี้มีบัญชีอยู่แล้ว',409,'EMAIL_EXISTS'); error_log('Registration failed: '.$e->getMessage()); fail('สมัครบัญชีไม่สำเร็จ กรุณาลองใหม่',500,'REGISTER_FAILED'); }
    respond(['ok'=>true,'pending'=>true,'message'=>'ส่งคำขอสมัครอาจารย์แล้ว กรุณารอแอดมินอนุมัติ','user'=>['name'=>$name,'email'=>$email,'role'=>'teacher','status'=>'pending']],201);
}
if ($action==='login') {
    $email=kuEmail($input['email']??''); $password=(string)($input['password']??''); $q=$pdo->prepare('SELECT id,name,email,password_hash,role,status,created_at FROM users WHERE email=? LIMIT 1'); $q->execute([$email]); $u=$q->fetch();
    if (!$u||!password_verify($password,$u['password_hash'])) fail('อีเมลหรือรหัสผ่านไม่ถูกต้อง',401,'INVALID_CREDENTIALS'); if ($u['status']==='pending') fail('บัญชียังรอแอดมินอนุมัติ',403,'ACCOUNT_PENDING'); if ($u['status']!=='active') fail('บัญชีนี้ไม่สามารถใช้งานได้ กรุณาติดต่อแอดมิน',403,'ACCOUNT_DISABLED'); session_regenerate_id(true); $_SESSION['user']=publicUser($u); $_SESSION['last_activity']=time(); respond(['ok'=>true,'user'=>publicUser($u),'message'=>'เข้าสู่ระบบสำเร็จ']);
}

if ($action==='rooms') {
    $date=dateValue($_GET['date']??date('Y-m-d')); $slot=trim((string)($_GET['time']??'08:00-12:00')); if (!preg_match('/^(\d{2}:\d{2})-(\d{2}:\d{2})$/',$slot,$m)) fail('ช่วงเวลาไม่ถูกต้อง',422,'INVALID_SLOT'); $start=timeValue($m[1]); $end=timeValue($m[2]); if ($start>=$end) fail('ช่วงเวลาไม่ถูกต้อง',422,'INVALID_SLOT');
    $sql="SELECT r.*,b.name AS building,EXISTS(SELECT 1 FROM bookings x WHERE x.room_id=r.id AND x.booking_date=? AND x.status='confirmed' AND x.start_time<? AND x.end_time>?) AS taken FROM rooms r JOIN buildings b ON b.id=r.building_id WHERE r.active=1"; $params=[$date,$end,$start];
    if (($v=trim((string)($_GET['building']??'')))!=='') {$sql.=' AND b.name=?';$params[]=$v;} if (($v=trim((string)($_GET['floor']??'')))!=='') {if(!ctype_digit($v))fail('ชั้นไม่ถูกต้อง',422,'INVALID_FLOOR');$sql.=' AND r.floor=?';$params[]=(int)$v;} if (($v=trim((string)($_GET['type']??'')))!=='') {$sql.=' AND r.room_type=?';$params[]=$v;} $sql.=' ORDER BY b.name,r.floor,r.room_no'; $q=$pdo->prepare($sql);$q->execute($params);respond(['rooms'=>roomRows($q->fetchAll())]);
}
if ($action==='schedule') { $date=dateValue($_GET['date']??date('Y-m-d')); $q=$pdo->prepare("SELECT b.id,b.room_id,b.booking_date,b.start_time,b.end_time,b.subject,r.room_no,bu.name AS building,u.name AS teacher FROM bookings b JOIN rooms r ON r.id=b.room_id JOIN buildings bu ON bu.id=r.building_id JOIN users u ON u.id=b.teacher_id WHERE b.booking_date=? AND b.status='confirmed' ORDER BY b.start_time,bu.name,r.room_no");$q->execute([$date]);respond(['bookings'=>$q->fetchAll()]); }

if ($action==='book') {
    $user=requireUser($pdo); if(!in_array($user['role'],['teacher','admin'],true))fail('สิทธิ์นี้สำหรับอาจารย์เท่านั้น',403,'TEACHER_REQUIRED'); $roomId=filter_var($input['room_id']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]); if(!$roomId)fail('ห้องไม่ถูกต้อง',422,'INVALID_ROOM'); $date=dateValue($input['date']??''); if($date<date('Y-m-d'))fail('ไม่สามารถจองวันที่ผ่านมาแล้วได้',422,'PAST_DATE'); $start=timeValue($input['start_time']??'');$end=timeValue($input['end_time']??'');if($start>=$end)fail('เวลาเริ่มต้องก่อนเวลาสิ้นสุด',422,'INVALID_SLOT');$subject=trim((string)($input['subject']??''));if($subject===''||mb_strlen($subject)>180)fail('กรุณาระบุหัวข้อหรือรายวิชาไม่เกิน 180 ตัวอักษร',422,'INVALID_SUBJECT');
    try { $pdo->beginTransaction(); $lock=$pdo->prepare('SELECT id FROM rooms WHERE id=? AND active=1 FOR UPDATE');$lock->execute([$roomId]);if(!$lock->fetch()){ $pdo->rollBack();fail('ไม่พบห้องนี้หรือห้องถูกปิดใช้งานแล้ว',404,'ROOM_NOT_FOUND'); } $overlap=$pdo->prepare("SELECT id FROM bookings WHERE room_id=? AND booking_date=? AND status='confirmed' AND start_time<? AND end_time>? LIMIT 1");$overlap->execute([$roomId,$date,$end,$start]);if($overlap->fetch()){ $pdo->rollBack();fail('ห้องถูกจองในช่วงเวลานี้แล้ว กรุณาเลือกช่วงเวลาอื่น',409,'BOOKING_CONFLICT'); }$ins=$pdo->prepare("INSERT INTO bookings(room_id,teacher_id,booking_date,start_time,end_time,subject,status) VALUES(?,?,?,?,?,?, 'confirmed')");$ins->execute([$roomId,$user['id'],$date,$start,$end,$subject]);$id=(int)$pdo->lastInsertId();$pdo->commit();respond(['ok'=>true,'booking_id'=>$id,'message'=>'จองห้องสำเร็จ'],201); }
    catch(PDOException $e){if($pdo->inTransaction())$pdo->rollBack();if((int)$e->errorInfo[1]===1062)fail('ห้องถูกจองในช่วงเวลานี้แล้ว กรุณาเลือกช่วงเวลาอื่น',409,'BOOKING_CONFLICT');error_log('Booking failed: '.$e->getMessage());fail('บันทึกการจองไม่สำเร็จ กรุณาลองใหม่',500,'BOOKING_FAILED');}
}

if ($action==='admin-rooms') {
    requireAdmin($pdo);
    $q=$pdo->query("SELECT r.id,r.building_id,r.floor,r.room_no,r.room_type,r.capacity,r.features,r.image_url,r.active,b.name AS building FROM rooms r JOIN buildings b ON b.id=r.building_id ORDER BY b.name,r.floor,r.room_no");
    respond(['rooms'=>roomRows($q->fetchAll())]);
}
if ($action==='add-room') {
    requireAdmin($pdo);
    [$building,$floor,$roomNo,$roomType,$capacity,$features,$image,$active]=roomInput($input);
    try {
        $pdo->beginTransaction();
        $q=$pdo->prepare('INSERT INTO buildings(name) VALUES(?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)');
        $q->execute([$building]); $buildingId=(int)$pdo->lastInsertId();
        $q=$pdo->prepare('INSERT INTO rooms(building_id,floor,room_no,room_type,capacity,features,image_url,active) VALUES(?,?,?,?,?,?,?,?)');
        $q->execute([$buildingId,$floor,$roomNo,$roomType,$capacity,json_encode($features,JSON_UNESCAPED_UNICODE),$image!==''?$image:null,$active]);
        $id=(int)$pdo->lastInsertId(); $pdo->commit();
        $q=$pdo->prepare('SELECT r.id,r.building_id,r.floor,r.room_no,r.room_type,r.capacity,r.features,r.image_url,r.active,b.name AS building FROM rooms r JOIN buildings b ON b.id=r.building_id WHERE r.id=?'); $q->execute([$id]);
        respond(['ok'=>true,'room'=>roomRows([$q->fetch()])[0],'message'=>'เพิ่มห้องเรียนสำเร็จ'],201);
    } catch(PDOException $e) { if($pdo->inTransaction())$pdo->rollBack(); if((int)($e->errorInfo[1]??0)===1062)fail('ห้องนี้มีอยู่แล้วในอาคารเดียวกัน',409,'ROOM_EXISTS'); error_log('Add room failed: '.$e->getMessage()); fail('เพิ่มห้องไม่สำเร็จ กรุณาลองใหม่',500,'ADD_ROOM_FAILED'); }
}
if ($action==='edit-room') {
    requireAdmin($pdo);
    $roomId=filter_var($input['room_id']??$input['id']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]); if(!$roomId) fail('ไม่พบห้องที่ต้องการแก้ไข',422,'INVALID_ROOM');
    [$building,$floor,$roomNo,$roomType,$capacity,$features,$image,$active]=roomInput($input);
    try {
        $pdo->beginTransaction();
        $lock=$pdo->prepare('SELECT id FROM rooms WHERE id=? FOR UPDATE'); $lock->execute([$roomId]); if(!$lock->fetch()){ $pdo->rollBack(); fail('ไม่พบห้องนี้',404,'ROOM_NOT_FOUND'); }
        $q=$pdo->prepare('INSERT INTO buildings(name) VALUES(?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)'); $q->execute([$building]); $buildingId=(int)$pdo->lastInsertId();
        $q=$pdo->prepare('UPDATE rooms SET building_id=?,floor=?,room_no=?,room_type=?,capacity=?,features=?,image_url=?,active=? WHERE id=?');
        $q->execute([$buildingId,$floor,$roomNo,$roomType,$capacity,json_encode($features,JSON_UNESCAPED_UNICODE),$image!==''?$image:null,$active,$roomId]);
        $pdo->commit(); $q=$pdo->prepare('SELECT r.id,r.building_id,r.floor,r.room_no,r.room_type,r.capacity,r.features,r.image_url,r.active,b.name AS building FROM rooms r JOIN buildings b ON b.id=r.building_id WHERE r.id=?'); $q->execute([$roomId]);
        respond(['ok'=>true,'room'=>roomRows([$q->fetch()])[0],'message'=>'บันทึกการแก้ไขห้องแล้ว']);
    } catch(PDOException $e) { if($pdo->inTransaction())$pdo->rollBack(); if((int)($e->errorInfo[1]??0)===1062)fail('ห้องนี้มีอยู่แล้วในอาคารเดียวกัน',409,'ROOM_EXISTS'); error_log('Edit room failed: '.$e->getMessage()); fail('แก้ไขห้องไม่สำเร็จ กรุณาลองใหม่',500,'EDIT_ROOM_FAILED'); }
}
if ($action==='delete-room') {
    requireAdmin($pdo);
    $roomId=filter_var($input['room_id']??$input['id']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]); if(!$roomId) fail('ไม่พบห้องที่ต้องการลบ',422,'INVALID_ROOM');
    $q=$pdo->prepare('UPDATE rooms SET active=0 WHERE id=?'); $q->execute([$roomId]); if($q->rowCount()<1) fail('ไม่พบห้องนี้ หรือห้องถูกลบแล้ว',404,'ROOM_NOT_FOUND');
    respond(['ok'=>true,'room_id'=>(int)$roomId,'message'=>'นำห้องออกจากระบบแล้ว (เก็บประวัติการจองไว้)']);
}
if ($action==='restore-room') {
    requireAdmin($pdo);
    $roomId=filter_var($input['room_id']??$input['id']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]); if(!$roomId) fail('ไม่พบห้องที่ต้องการกู้คืน',422,'INVALID_ROOM');
    $q=$pdo->prepare('UPDATE rooms SET active=1 WHERE id=?'); $q->execute([$roomId]); if($q->rowCount()<1) fail('ไม่พบห้องนี้',404,'ROOM_NOT_FOUND');
    respond(['ok'=>true,'room_id'=>(int)$roomId,'message'=>'เปิดใช้งานห้องแล้ว']);
}
if ($action==='pending-users'||$action==='admin-users') { requireAdmin($pdo);$q=$pdo->query("SELECT id,name,email,role,status,created_at FROM users WHERE role='teacher' ORDER BY FIELD(status,'pending','active','rejected'),created_at DESC");respond(['users'=>$q->fetchAll()]); }
if ($action==='review-user'||$action==='approve-teacher'||$action==='approve-user') { requireAdmin($pdo);$id=filter_var($input['user_id']??$input['id']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);$status=$action==='approve-teacher'?'active':(string)($input['status']??'');if(!$id||!in_array($status,['active','rejected'],true))fail('คำขออนุมัติไม่ถูกต้อง',422,'INVALID_REVIEW');$q=$pdo->prepare("UPDATE users SET status=? WHERE id=? AND role='teacher'");$q->execute([$status,$id]);if($q->rowCount()<1)fail('ไม่พบคำขออาจารย์นี้',404,'USER_NOT_FOUND');respond(['ok'=>true,'message'=>$status==='active'?'อนุมัติอาจารย์แล้ว':'ปฏิเสธคำขอแล้ว']); }
fail('ไม่พบคำสั่งที่ร้องขอ',404,'NOT_FOUND');




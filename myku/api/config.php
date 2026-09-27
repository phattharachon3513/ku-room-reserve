<?php

return [
    'host' => getenv('MYSQLHOST') ?: '127.0.0.1',
    'port' => getenv('MYSQLPORT') ?: '3306',
    'database' => getenv('MYSQLDATABASE') ?: 'ku_room_reserve',
    'username' => getenv('MYSQLUSER') ?: 'root',
    'password' => getenv('MYSQLPASSWORD') ?: '',
    'charset' => getenv('MYSQLCHARSET') ?: 'utf8mb4',

    'session_idle_timeout' => (int)(
        getenv('KU_SESSION_IDLE_TIMEOUT') ?: 1800
    ),

    'allowed_origins' => getenv('KU_ALLOWED_ORIGINS') ?: '',
];
<?php

return [
    'host' => getenv('MYSQLHOST'),
    'port' => getenv('MYSQLPORT') ?: '3306',
    'database' => getenv('MYSQLDATABASE'),
    'username' => getenv('MYSQLUSER'),
    'password' => getenv('MYSQLPASSWORD'),
    'charset' => 'utf8mb4',

    'session_idle_timeout' => (int)(
        getenv('KU_SESSION_IDLE_TIMEOUT') ?: 1800
    ),

    'allowed_origins' => getenv('KU_ALLOWED_ORIGINS') ?: '',
];

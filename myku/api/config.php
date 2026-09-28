<?php

return [
    'host' => getenv('MYSQLHOST') ?: 'shortline.proxy.rlwy.net:29836',
    'port' => getenv('MYSQLPORT') ?: '3306',
    'database' => getenv('MYSQLDATABASE') ?: 'railway',
    'username' => getenv('MYSQLUSER') ?: 'root',
    'password' => getenv('MYSQLPASSWORD') ?: 'VnANDnulciYgctXKflHlaAarCgVVnLUE',
    'charset' => getenv('MYSQLCHARSET') ?: 'utf8mb4',

    'session_idle_timeout' => (int)(
        getenv('KU_SESSION_IDLE_TIMEOUT') ?: 1800
    ),

    'allowed_origins' => getenv('KU_ALLOWED_ORIGINS') ?: '',
];

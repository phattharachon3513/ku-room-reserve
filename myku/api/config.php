<?php

return [
    'host' => 'shortline.proxy.rlwy.net:29836',
    'port' => '3306',
    'database' => 'railway',
    'username' => 'root,
    'password' => 'VnANDnulciYgctXKflHlaAarCgVVnLUE,
    'charset' => 'utf8mb4',

    'session_idle_timeout' => (int)(
        getenv('KU_SESSION_IDLE_TIMEOUT') ?: 1800
    ),

    'allowed_origins' => getenv('KU_ALLOWED_ORIGINS') ?: '',
];

<?php

return [
    'host' => 'shortline.proxy.rlwy.net',
    'port' => '29836',
    'database' => 'railway',
    'username' => 'root',
    'password' => 'VnANDnulciYgctXKflHlaAarCgVVnLUE',
    'charset' => 'utf8mb4',

    'session_idle_timeout' => (int)(
        getenv('KU_SESSION_IDLE_TIMEOUT') ?: 1800
    ),

    'allowed_origins' => getenv('KU_ALLOWED_ORIGINS') ?: '',
];

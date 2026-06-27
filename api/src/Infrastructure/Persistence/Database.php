<?php

declare(strict_types=1);

namespace Landcare\Infrastructure\Persistence;

use PDO;

/** PDO factory for MySQL 8 (system of record). */
final class Database
{
    public static function connect(array $env): PDO
    {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            $env['DB_HOST'] ?? '127.0.0.1',
            $env['DB_PORT'] ?? '3306',
            $env['DB_NAME'] ?? 'landcarelink',
        );
        return new PDO($dsn, $env['DB_USER'] ?? 'root', $env['DB_PASSWORD'] ?? '', [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
}

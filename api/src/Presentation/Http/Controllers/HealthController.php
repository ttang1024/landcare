<?php

declare(strict_types=1);

namespace Landcare\Presentation\Http\Controllers;

use Landcare\Presentation\Http\JsonResponse;
use PDO;

/** Module 11 — health checks. */
final class HealthController
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function index(): JsonResponse
    {
        $checks = ['db' => $this->dbOk()];
        $status = in_array(false, $checks, true) ? 'degraded' : 'ok';
        return new JsonResponse(['status' => $status, 'checks' => $checks]);
    }

    private function dbOk(): bool
    {
        try {
            $this->pdo->query('SELECT 1');
            return true;
        } catch (\Throwable) {
            return false;
        }
    }
}

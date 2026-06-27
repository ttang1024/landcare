<?php

declare(strict_types=1);

namespace Landcare\Presentation\Http\Middleware;

/**
 * Fixed-window per-IP rate limiter (Module 12). File-backed for the scaffold;
 * production should use Redis/APCu. Returns true when the request is allowed.
 */
final class RateLimiter
{
    public function __construct(
        private readonly int $perMinute = 60,
        private readonly string $dir = '/tmp/landcare-rl',
    ) {
    }

    public function allow(string $clientIp): bool
    {
        if (!is_dir($this->dir)) {
            @mkdir($this->dir, 0700, true);
        }
        $window = (int) floor(time() / 60);
        $file = $this->dir . '/' . md5($clientIp) . '-' . $window;
        $count = is_file($file) ? (int) file_get_contents($file) : 0;
        if ($count >= $this->perMinute) {
            return false;
        }
        file_put_contents($file, (string) ($count + 1), LOCK_EX);
        return true;
    }
}

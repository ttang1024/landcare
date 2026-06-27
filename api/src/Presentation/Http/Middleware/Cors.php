<?php

declare(strict_types=1);

namespace Landcare\Presentation\Http\Middleware;

/** Emits CORS headers for the allow-listed frontend origins (Module 12). */
final class Cors
{
    /** @param list<string> $allowedOrigins */
    public function __construct(private readonly array $allowedOrigins)
    {
    }

    public function headersFor(?string $origin): array
    {
        if ($origin !== null && in_array($origin, $this->allowedOrigins, true)) {
            return [
                'Access-Control-Allow-Origin' => $origin,
                'Access-Control-Allow-Methods' => 'GET,POST,PATCH,OPTIONS',
                'Access-Control-Allow-Headers' => 'Content-Type,X-CSRF-Token,Authorization',
                'Vary' => 'Origin',
            ];
        }
        return [];
    }
}

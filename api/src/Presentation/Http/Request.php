<?php

declare(strict_types=1);

namespace Landcare\Presentation\Http;

/** Minimal immutable HTTP request abstraction. */
final class Request
{
    /**
     * @param array<string,string> $query
     * @param array<string,mixed> $body
     * @param array<string,string> $headers
     */
    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $query,
        public readonly array $body,
        public readonly array $headers,
        public string $requestId = '',
    ) {
    }

    public static function fromGlobals(): self
    {
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $raw = file_get_contents('php://input') ?: '';
        $body = $raw !== '' ? (json_decode($raw, true) ?? []) : $_POST;
        $headers = function_exists('getallheaders') ? (getallheaders() ?: []) : [];
        return new self(
            method: $_SERVER['REQUEST_METHOD'] ?? 'GET',
            path: rtrim($path, '/') ?: '/',
            query: $_GET,
            body: is_array($body) ? $body : [],
            headers: array_change_key_case($headers, CASE_LOWER),
        );
    }

    public function query(string $key, ?string $default = null): ?string
    {
        return $this->query[$key] ?? $default;
    }

    public function header(string $key): ?string
    {
        return $this->headers[strtolower($key)] ?? null;
    }
}

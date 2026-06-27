<?php

declare(strict_types=1);

namespace Landcare\Presentation\Http;

final class JsonResponse
{
    /** @param array<string,string> $headers */
    public function __construct(
        public readonly mixed $data,
        public readonly int $status = 200,
        public readonly array $headers = [],
    ) {
    }

    public static function error(string $code, string $message, int $status, string $requestId): self
    {
        return new self(
            ['error' => ['code' => $code, 'message' => $message, 'requestId' => $requestId]],
            $status,
        );
    }

    public function send(): void
    {
        http_response_code($this->status);
        header('Content-Type: application/json; charset=utf-8');
        foreach ($this->headers as $name => $value) {
            header("{$name}: {$value}");
        }
        echo json_encode($this->data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
}

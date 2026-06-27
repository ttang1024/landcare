<?php

declare(strict_types=1);

namespace Landcare\Infrastructure\Observability;

/**
 * Structured JSON logger with request-id correlation (Module 11).
 * Never logs private contacts, emails, API keys or PII — callers must pass
 * already-redacted context; keys matching the deny-list are stripped defensively.
 */
final class Logger
{
    private const DENY = ['email', 'phone', 'api_key', 'apiKey', 'contact', 'password', 'token'];

    /** @var resource */
    private $sink;

    /** @param resource|null $sink Defaults to php://stderr (works in any SAPI; the STDERR constant is CLI-only). */
    public function __construct(
        private string $requestId = '-',
        $sink = null,
    ) {
        $this->sink = $sink ?? fopen('php://stderr', 'w');
    }

    public function withRequestId(string $requestId): self
    {
        return new self($requestId, $this->sink);
    }

    public function info(string $event, array $context = []): void
    {
        $this->write('info', $event, $context);
    }

    public function warning(string $event, array $context = []): void
    {
        $this->write('warning', $event, $context);
    }

    public function error(string $event, array $context = []): void
    {
        $this->write('error', $event, $context);
    }

    private function write(string $level, string $event, array $context): void
    {
        $line = json_encode([
            'ts' => date(DATE_ATOM),
            'level' => $level,
            'event' => $event,
            'requestId' => $this->requestId,
            'context' => $this->redact($context),
        ], JSON_UNESCAPED_SLASHES);
        fwrite($this->sink, $line . PHP_EOL);
    }

    /** @param array<string,mixed> $context */
    private function redact(array $context): array
    {
        foreach ($context as $key => $value) {
            foreach (self::DENY as $deny) {
                if (stripos((string) $key, $deny) !== false) {
                    $context[$key] = '[redacted]';
                    continue 2;
                }
            }
            if (is_array($value)) {
                $context[$key] = $this->redact($value);
            }
        }
        return $context;
    }
}

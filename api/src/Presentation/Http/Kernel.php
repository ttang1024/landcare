<?php

declare(strict_types=1);

namespace Landcare\Presentation\Http;

use DI\ContainerBuilder;
use Dotenv\Dotenv;
use Landcare\Infrastructure\Observability\Logger;
use Landcare\Presentation\Http\Middleware\Cors;
use Landcare\Presentation\Http\Middleware\RateLimiter;
use Psr\Container\ContainerInterface;
use Ramsey\Uuid\Uuid;

/**
 * Boots DI, applies cross-cutting middleware (request-id, CORS, rate limit, CSRF)
 * and dispatches routes. Keeps the front controller a one-liner.
 */
final class Kernel
{
    private function __construct(
        private readonly ContainerInterface $container,
        private readonly Router $router,
        private readonly array $env,
    ) {
    }

    public static function boot(string $basePath): self
    {
        if (is_file($basePath . '/../.env')) {
            Dotenv::createImmutable($basePath . '/..')->safeLoad();
        }
        $builder = new ContainerBuilder();
        $builder->addDefinitions($basePath . '/config/container.php');
        $container = $builder->build();

        $router = new Router();
        (require $basePath . '/config/routes.php')($router, $container);

        return new self($container, $router, $_ENV + $_SERVER);
    }

    public function run(): void
    {
        $request = Request::fromGlobals();
        $request->requestId = Uuid::uuid4()->toString();
        header('X-Request-Id: ' . $request->requestId);

        $cors = new Cors(array_filter(explode(',', $this->env['CORS_ALLOWED_ORIGINS'] ?? '')));
        $corsHeaders = $cors->headersFor($request->header('origin'));
        foreach ($corsHeaders as $name => $value) {
            header("{$name}: {$value}");
        }
        if ($request->method === 'OPTIONS') {
            http_response_code(204);
            return;
        }

        // CSRF: state-changing requests from the browser must present the header.
        if (in_array($request->method, ['POST', 'PATCH', 'DELETE'], true)
            && $request->header('origin') !== null
            && $request->header('x-csrf-token') === null) {
            JsonResponse::error('csrf', 'Missing CSRF token', 419, $request->requestId)->send();
            return;
        }

        $limiter = new RateLimiter((int) ($this->env['RATE_LIMIT_PER_MINUTE'] ?? 60));
        if (!$limiter->allow($_SERVER['REMOTE_ADDR'] ?? 'cli')) {
            JsonResponse::error('rate_limited', 'Too many requests', 429, $request->requestId)->send();
            return;
        }

        try {
            $response = $this->router->dispatch($request);
        } catch (\Throwable $e) {
            $this->container->get(Logger::class)
                ->withRequestId($request->requestId)
                ->error('unhandled', ['message' => $e->getMessage()]);
            $response = JsonResponse::error('internal', 'Internal error', 500, $request->requestId);
        }
        $response->send();
    }
}

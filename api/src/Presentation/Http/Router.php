<?php

declare(strict_types=1);

namespace Landcare\Presentation\Http;

/** Tiny regex router. Patterns use {param} placeholders. */
final class Router
{
    /** @var list<array{method:string,regex:string,params:list<string>,handler:callable}> */
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler): void
    {
        $params = [];
        $regex = preg_replace_callback('/\{(\w+)\}/', function ($m) use (&$params) {
            $params[] = $m[1];
            return '([^/]+)';
        }, $pattern);
        $this->routes[] = [
            'method' => $method,
            'regex' => '#^' . $regex . '$#',
            'params' => $params,
            'handler' => $handler,
        ];
    }

    public function dispatch(Request $request): JsonResponse
    {
        foreach ($this->routes as $route) {
            if ($route['method'] !== $request->method) {
                continue;
            }
            if (preg_match($route['regex'], $request->path, $matches)) {
                $args = array_combine($route['params'], array_slice($matches, 1)) ?: [];
                return ($route['handler'])($request, $args);
            }
        }
        return JsonResponse::error('not_found', 'Route not found', 404, $request->requestId);
    }
}

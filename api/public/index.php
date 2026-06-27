<?php

declare(strict_types=1);

use Landcare\Presentation\Http\Kernel;

require __DIR__ . '/../vendor/autoload.php';

/*
 * Front controller. Boots the DI container, applies global middleware
 * (request-id, CORS, rate limit, CSRF), dispatches the route, and emits JSON.
 */
$kernel = Kernel::boot(dirname(__DIR__));
$kernel->run();

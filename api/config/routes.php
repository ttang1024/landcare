<?php

declare(strict_types=1);

use Landcare\Presentation\Http\Controllers;
use Landcare\Presentation\Http\Router;
use Psr\Container\ContainerInterface;

/** Route table (API contracts in docs/api-contracts.md). */
return function (Router $r, ContainerInterface $c): void {
    $r->add('GET', '/v1/map/groups', fn ($req) => $c->get(Controllers\MapController::class)->groups($req));

    $r->add('GET', '/v1/health', fn () => $c->get(Controllers\HealthController::class)->index());
};

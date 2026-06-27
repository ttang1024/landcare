<?php

declare(strict_types=1);

use Landcare\Domain\Group\GroupRepository;
use Landcare\Infrastructure\Observability\Logger;
use Landcare\Infrastructure\Persistence\Database;
use Landcare\Infrastructure\Persistence\MySqlGroupRepository;
use Psr\Container\ContainerInterface;

use function DI\autowire;
use function DI\factory;

/**
 * DI definitions (ADR-0002). Domain interfaces → Infrastructure implementations.
 * Business logic only ever asks for interfaces, so swaps are localized here.
 */
return [
    'env' => fn () => $_ENV + $_SERVER,

    PDO::class => factory(fn (ContainerInterface $c) => Database::connect($c->get('env'))),
    Logger::class => autowire(),

    GroupRepository::class => autowire(MySqlGroupRepository::class),
];

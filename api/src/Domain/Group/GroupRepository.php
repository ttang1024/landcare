<?php

declare(strict_types=1);

namespace Landcare\Domain\Group;

interface GroupRepository
{
    /** @param array<string,mixed> $filters region,type,focus,status,bbox */
    public function search(array $filters): array;
}

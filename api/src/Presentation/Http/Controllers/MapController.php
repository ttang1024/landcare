<?php

declare(strict_types=1);

namespace Landcare\Presentation\Http\Controllers;

use Landcare\Domain\Group\GroupRepository;
use Landcare\Presentation\Http\JsonResponse;
use Landcare\Presentation\Http\Request;

/** Module 1 — catchment map data. Responses are privacy-redacted by the mapper. */
final class MapController
{
    public function __construct(private readonly GroupRepository $groups)
    {
    }

    public function groups(Request $request): JsonResponse
    {
        return new JsonResponse(['groups' => $this->groups->search([
            'region' => $request->query('region'),
            'type' => $request->query('type'),
            'focus' => $request->query('focus'),
            'status' => $request->query('status'),
        ])]);
    }
}

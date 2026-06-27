<?php

declare(strict_types=1);

namespace Landcare\Tests\Unit;

use Landcare\Domain\Common\GeoPoint;
use PHPUnit\Framework\TestCase;

final class GeoPointTest extends TestCase
{
    public function testHaversineDistanceHamiltonToAuckland(): void
    {
        $hamilton = new GeoPoint(-37.7870, 175.2793);
        $auckland = new GeoPoint(-36.8485, 174.7633);
        // ~110km as the crow flies.
        self::assertEqualsWithDelta(110, $hamilton->distanceKm($auckland), 8);
    }

    public function testRejectsInvalidCoordinate(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new GeoPoint(200, 0);
    }
}

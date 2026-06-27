<?php

declare(strict_types=1);

namespace Landcare\Domain\Common;

use InvalidArgumentException;

/** Immutable WGS84 coordinate. */
final class GeoPoint
{
    public function __construct(public readonly float $lat, public readonly float $lng)
    {
        if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
            throw new InvalidArgumentException('Coordinate out of range');
        }
    }

    /** Great-circle distance in kilometres (haversine). */
    public function distanceKm(GeoPoint $other): float
    {
        $r = 6371.0;
        $dLat = deg2rad($other->lat - $this->lat);
        $dLng = deg2rad($other->lng - $this->lng);
        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($this->lat)) * cos(deg2rad($other->lat)) * sin($dLng / 2) ** 2;
        return $r * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}

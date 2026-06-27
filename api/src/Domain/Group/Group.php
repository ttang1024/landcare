<?php

declare(strict_types=1);

namespace Landcare\Domain\Group;

use Landcare\Domain\Common\GeoPoint;

/**
 * A catchment/community/environmental group.
 *
 * Privacy (ADR-0006): contactEmail/contactPhone are only ever populated by the
 * repository mapper when the corresponding publish flag is true. By the time a
 * Group reaches any other layer it is already redacted.
 */
final class Group implements \JsonSerializable
{
    /** @param list<string> $focusAreas */
    public function __construct(
        public readonly string $id,
        public readonly string $name,
        public readonly string $type,
        public readonly string $region,
        public readonly string $status,
        public readonly array $focusAreas,
        public readonly ?string $description,
        public readonly ?string $website,
        public readonly ?GeoPoint $location,
        public readonly bool $publishContact,
        public readonly ?string $contactEmail = null,
        public readonly ?string $contactPhone = null,
    ) {
    }

    public function jsonSerialize(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'type' => $this->type,
            'region' => $this->region,
            'status' => $this->status,
            'focusAreas' => $this->focusAreas,
            'description' => $this->description,
            'website' => $this->website,
            'location' => $this->location
                ? ['lat' => $this->location->lat, 'lng' => $this->location->lng]
                : null,
            // Private fields are omitted entirely when not publishable.
            'contactEmail' => $this->publishContact ? $this->contactEmail : null,
            'contactPhone' => $this->publishContact ? $this->contactPhone : null,
        ];
    }
}

<?php

declare(strict_types=1);

namespace Landcare\Tests\Unit;

use Landcare\Domain\Group\Group;
use PHPUnit\Framework\TestCase;

/** Module 13 — the assistant/map must never expose suppressed contact data. */
final class GroupPrivacyTest extends TestCase
{
    public function testSuppressedContactsAreNotSerialised(): void
    {
        $group = new Group(
            id: 'g1', name: 'Waikato Catchment', type: 'catchment', region: 'Waikato',
            status: 'active', focusAreas: ['riparian'], description: null, website: null,
            location: null, publishContact: false,
            contactEmail: 'secret@example.org', contactPhone: '+64 21 000 000',
        );

        $json = $group->jsonSerialize();

        self::assertNull($json['contactEmail']);
        self::assertNull($json['contactPhone']);
        self::assertStringNotContainsString('secret@example.org', json_encode($json));
    }

    public function testPublishedContactsAreSerialised(): void
    {
        $group = new Group(
            id: 'g2', name: 'Coastal Care', type: 'community', region: 'Otago',
            status: 'active', focusAreas: [], description: null, website: null,
            location: null, publishContact: true,
            contactEmail: 'hello@example.org', contactPhone: null,
        );

        self::assertSame('hello@example.org', $group->jsonSerialize()['contactEmail']);
    }
}

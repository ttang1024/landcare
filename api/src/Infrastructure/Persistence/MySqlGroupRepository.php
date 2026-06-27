<?php

declare(strict_types=1);

namespace Landcare\Infrastructure\Persistence;

use Landcare\Domain\Common\GeoPoint;
use Landcare\Domain\Group\Group;
use Landcare\Domain\Group\GroupRepository;
use PDO;

/**
 * MySQL-backed groups. The mapper is the SINGLE privacy choke point (ADR-0006):
 * contact fields are only hydrated when the matching publish flag is set, so no
 * higher layer — including the AI agent — can ever see suppressed PII.
 */
final class MySqlGroupRepository implements GroupRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function search(array $filters): array
    {
        $sql = 'SELECT g.*, GROUP_CONCAT(f.focus_area) AS focus
                FROM `groups` g LEFT JOIN group_focus_areas f ON f.group_id = g.id WHERE 1=1';
        $params = [];
        foreach (['region' => 'g.region', 'type' => 'g.type', 'status' => 'g.status'] as $key => $col) {
            if (!empty($filters[$key])) {
                $sql .= " AND {$col} = :{$key}";
                $params[$key] = $filters[$key];
            }
        }
        if (!empty($filters['focus'])) {
            $sql .= ' AND f.focus_area = :focus';
            $params['focus'] = $filters['focus'];
        }
        $sql .= ' GROUP BY g.id LIMIT 500';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return array_map([$this, 'hydrate'], $stmt->fetchAll());
    }

    /** @param array<string,mixed> $row */
    private function hydrate(array $row): Group
    {
        $publishContact = (bool) $row['publish_contact'];
        return new Group(
            id: $row['id'],
            name: $row['name'],
            type: $row['type'],
            region: $row['region'],
            status: $row['status'],
            focusAreas: $row['focus'] ? explode(',', $row['focus']) : [],
            description: $row['description'],
            website: $row['website'],
            location: ($row['lat'] !== null && $row['lng'] !== null)
                ? new GeoPoint((float) $row['lat'], (float) $row['lng']) : null,
            publishContact: $publishContact,
            // Privacy choke point: never hydrate suppressed fields.
            contactEmail: ($publishContact && $row['publish_email']) ? $row['contact_email'] : null,
            contactPhone: ($publishContact && $row['publish_phone']) ? $row['contact_phone'] : null,
        );
    }
}

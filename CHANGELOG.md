# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-11-15

### Added

- One device per located house of Gladys and per fishing spot (up to three,
  coordinates typed in the configuration): solunar period in progress, period
  active, next period and minutes before it, day rating 0 to 4, moon phase and
  illumination, computed locally every minute.
- The `solunar_day` dashboard widget: today's major and minor periods at a
  place, the day rating and the moon.
- The `period_started` scene trigger, filtered by place, kind and day rating.
- The `solunar_day` scene action: the periods, rating and moon of today or
  tomorrow at a place.
- The `check_places` action, and documentation in English, French, German and
  Spanish.

[Unreleased]: https://github.com/guim31/gladys-solunar/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-solunar/releases/tag/v1.0.0

# Changelog

All notable changes to ClaudeClaw will be documented here.

## [v1.2.0] - 2026-03-06

### Changed
- Personal assistant configuration (`CLAUDE.md`) now lives outside the repo in a dedicated config folder (default `~/.claudeclaw`), keeping your name, vault paths, and AI persona out of version control
- Setup wizard guides you through choosing a config folder and copies the example config there on first run

## [v1.1.1] - 2026-03-06

### Added
- Migration system with versioned migration files
- `add-migration` Claude skill for scaffolding new versioned migrations

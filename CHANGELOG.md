# Changelog

All notable changes to ClaudeClaw will be documented here.

## [v1.2.0] - 2026-04-19

### Added
- Local SQLite tables for operational state previously held in Supabase: `kanban_tasks`, `agent_heartbeats`, `agent_events` (migration `v1.2.0/port-supabase-operational-tables`). `hive_mind` already existed. `fragrance_catalog` and `bot_kv` remain in Supabase because the DION app and PM2 trading bots depend on them externally.

## [v1.1.1] - 2026-03-06

### Added
- Migration system with versioned migration files
- `add-migration` Claude skill for scaffolding new versioned migrations

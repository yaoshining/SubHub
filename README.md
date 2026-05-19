## Overview

SubBridge is designed for teams or individuals who want a unified subtitle service instead of depending on a single subtitle provider.

It can sit between your applications and multiple subtitle sources, providing:

- Unified search and download APIs
- Provider adapter support for services like OpenSubtitles and other community subtitle sources
- Local caching for downloaded subtitles
- Manual subtitle upload and management
- A foundation for private deployments and secondary development

The goal is to make subtitle access more stable, extensible, and controllable.

## Why This Project

Most subtitle providers have one or more of the following limitations:

- Rate limits
- Unstable or unofficial APIs
- Region-specific accessibility issues
- Missing upload or management workflows
- No local cache or unified API layer

SubBridge addresses these problems by introducing a provider abstraction layer and a local subtitle store, so applications only need to integrate once.

## Core Features

- Aggregate multiple subtitle providers behind one API
- Cache subtitle files and metadata locally
- Support manual subtitle uploads
- Normalize provider responses into a unified schema
- Provide provider fallback when one source is unavailable
- Allow self-hosted deployment for private media workflows
- Offer a clean base for custom provider integrations

## Planned Provider Types

- Official provider APIs
  - Example: OpenSubtitles
- Community subtitle sites
  - Example: ASSRT, Shooter, Xunlei, SubtitleBest
- Local upload source
- Local cache source

## Typical Use Cases

- Build a private subtitle API for Jellyfin, Plex, Emby, or custom media apps
- Cache subtitle files locally to reduce repeated upstream requests
- Add manual upload capability for subtitles not available from upstream providers
- Normalize subtitle search across domestic and international providers
- Use as a base for a subtitle management platform or internal service

## Architecture

SubBridge is intended to follow a modular architecture:

- API Layer
  - Exposes unified search, download, upload, and cache endpoints
- Provider Adapter Layer
  - Connects to external subtitle sources through pluggable adapters
- Cache Layer
  - Stores subtitle files and metadata locally
- Storage Layer
  - Persists uploaded files, normalized records, and provider mappings
- Admin Layer
  - Manages providers, uploads, cache, and moderation rules

## Design Principles

- Provider-agnostic
- Self-hosted first
- Easy to extend
- Cache-friendly
- Stable external API
- Suitable for secondary development

## Roadmap

- Provider adapter interface
- OpenSubtitles integration
- Local file cache
- Manual upload API
- Subtitle metadata normalization
- Search and download history
- Authentication and access control
- Admin dashboard
- More domestic provider adapters
- Webhook or media-server integration

## Non-Goals

- Public redistribution of third-party subtitle content without checking provider terms
- Tight coupling to a single media server
- Hardcoded dependency on any one subtitle source

## Legal Notice

This project is intended as a self-hosted subtitle aggregation and management service.

Before connecting to any third-party subtitle provider, you should review:

- API usage limits
- Terms of service
- Redistribution policies
- Copyright and local compliance requirements

Some subtitle sources may not provide official public APIs. Integrating such sources may require additional maintenance and legal review.

## Status

This project is currently in the planning / early development stage.

## Contributing

Issues and pull requests are welcome. Provider adapters, cache improvements, metadata normalization, and deployment examples are especially valuable.

## License

MIT

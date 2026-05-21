# Page Spec Template

## Metadata

- **Page**: [page name]
- **Route / Entry Point**: [URL, screen path, or navigation entry]
- **Status**: Draft / Active / Deprecated
- **Last Updated**: [YYYY-MM-DD]
- **Related Feature Specs**: [links to `specs/.../spec.md` if relevant]

## Goal

[Describe the primary purpose of this page and the outcome it should help the user achieve.]

## Audience / Scenario

- **Primary user**: [who uses this page]
- **Primary scenario**: [what they are trying to do]
- **Frequency / importance**: [how critical this page is]

## Modules / Sections

List the page top to bottom. Keep this structural rather than visual.

1. [Section name]: [purpose]
2. [Section name]: [purpose]
3. [Section name]: [purpose]

## Key States

- **Default state**: [what the page shows in the normal case]
- **Loading state**: [what appears while data is loading]
- **Empty state**: [what appears when there is no data]
- **Error state**: [what appears when something fails]
- **Permission / access state**: [if applicable]

## Content Hierarchy

- **Primary information**: [what must stand out first]
- **Secondary information**: [supporting information]
- **Tertiary information**: [fine detail, metadata, diagnostics]
- **Primary actions**: [most important CTAs or controls]
- **Secondary actions**: [supporting controls]

## Interaction Rules

- [Describe page-specific interaction patterns, e.g. filter behavior, selection model, autosave, inline edit rules]
- [Describe any rules that are unique to this page]

## Page-Specific Design Rules

- **Relevant global rules from `DESIGN.md`**: [list the sections or component families this page relies on]
- **Allowed overrides**: [only page-specific adjustments that do not change the global system]
- **Forbidden deviations**: [things this page must not do]

## Data / Dependencies

- **Data sources**: [APIs, stores, services]
- **External dependencies**: [third-party services, feature flags, integrations]
- **Cross-page dependencies**: [pages or flows this page links to or relies on]

## Notes

- [Implementation notes, known tradeoffs, follow-up items]

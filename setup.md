---
layout: page
permalink: /setup/
title: Make it your own.
eyebrow: Template guide
description: A normal Jekyll project, with a shared design shell and editable content.
---
## Run locally

Install Ruby and Bundler, then run:

```sh
bundle install
bundle exec jekyll serve
```

## Build for hosting

```sh
bundle exec jekyll build --destination dist
```

Publish `dist` to any static host. Set `url` and `baseurl` in `_config.yml` for your destination; all internal links and assets use Jekyll’s `relative_url` filter.

## Edit the content

Set the site name in `_config.yml`, destinations in `_data/navigation.yml`, and page context in front matter. Use `layout: page` for documents and `layout: post` for journal entries. A `toc` array supplies explicit section IDs and labels.

## Keep the contract

`assets/css/shell.css` is the exported Astro stylesheet. Its checksum lives in `_data/shell.json`. Update that file from the authoritative export; put Jekyll composition changes in `assets/css/jekyll.css`. Avoid patching a second copy of a shared component’s styling.

{% if site.source_archive %}[Download the template source]({{ '/template.zip' | relative_url }}).{% endif %}

## Explore the content classes

[The example library]({{ '/examples/' | relative_url }}) contains 50 recipes built from eight composition frames and typed reusable sections. Standalone content lives in `_data/examples.json`; each page selects a record and composition through front matter. Class-specific includes add event context and article navigation. The portable schema and Astro/React adapter guidance are included in `docs/archetypes/` in the source download.

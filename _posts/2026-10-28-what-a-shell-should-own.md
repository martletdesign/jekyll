---
title: What a shell should own.
description: A narrow article is a different composition, even on the same screen.
author: The design workshop
tags: [Design, Publishing]
toc:
  - {id: the-frame, title: The frame}
  - {id: the-reading, title: The reading}
  - {id: the-contract, title: The contract}
---
## The frame

A website shell should own the recurring relationships: the site identity, navigation, masthead, reading measures, and footer. A page supplies its subject, metadata, and content.

This article puts its contents inside the narrow reading column. The wide language page puts its index to the left. Both can be viewed on the same screen: the composition follows the available content space, not only the viewport.

## The reading

A date and an author belong with the title. Tags describe the article. They are not loose paragraphs dropped between the masthead and the opening sentence.

The main text begins below the masthead. It has enough room for a sustained thought, without stretching each line across the full screen.

## The contract

Jekyll renders the page before it reaches the browser. The shared CSS still recognizes the same masthead, container, heading, and footer classes. That is the abstraction being tested here.

```html
<header class="page-intro">
  <div class="page-intro__shade">
    <div class="container page-intro__content">…</div>
  </div>
</header>
```

The markup above illustrates the Martlet masthead; Krigsvold uses its own `page-masthead` hierarchy. Shared concepts do not require identical family markup.

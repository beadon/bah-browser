---
name: site-search
description: Use the site's own search/destination box, which shows live results while you type.
states: [searchbox]
tasks: [search]
priority: 35
---
This page has its own search field (search bar, "Where are you going?", destination, city, product). Use it instead of Google or guessing URLs.
1. Click the field (click_ref), then type the term with fill_ref — short and specific ("Stowe, Vermont", "Los Angeles").
2. Most sites show live results/suggestions UNDER the field as you type. Use { "action": "wait", "ms": 2000 } once so they can appear.
3. A SUGGESTIONS LIST at the top means the list is open: click the matching entry (see autocomplete-pick). Typed text alone is often ignored.
4. No list after waiting? press "Enter", or click the search/submit button next to the field.
5. Then fill the remaining fields (dates, guests) and search. Re-check that the field still shows your choice before submitting.

---
name: job-apply
description: Find job postings and fill an application with the user's own documents — the user approves the send.
tasks: [jobs]
priority: 60
---
1. Find jobs: the link the user gave; their recommended jobs (a signed-in job board shows them on its HOME page under "Matches your preferences", "Jobs for you" or "Recommended" — extract_text there; "My jobs" is saved/applied jobs, not recommendations); or the board's search (title + place). Clicking a job card shows its details beside the list; extract_text: title, company, location, pay, must-haves.
2. View/find only → report title, company, location, pay, link and stop. Never click Apply then.
3. Résumé: list_files in the folder the user allowed, read_file the candidates, pick the closest to the posting and say why. No folder → upload; the user picks.
4. Click "Apply" / "Apply now" / "Easy apply"; "Apply on company site" → follow it. Sign-in or create-account page → stop and ask the user to sign in.
5. Fill only with facts from the résumé or the request. Unknown answers (salary, visa, start date, references, essays) → ask the user; never invent. Voluntary self-identification → "Decline to answer" unless told otherwise.
6. Continue / Next through the steps; extract_text the review page and check it.
7. Final submit: Bah asks the user. Cancelled → stop and report what is filled.
8. Report job, company, link and confirmation text. Apply to no more jobs than asked.

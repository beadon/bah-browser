---
name: job-apply
description: Find a job posting and fill its application with the user's own documents — the user approves the send.
tasks: [jobs]
priority: 60
---
1. Find the posting: the link the user gave, or the job board's own search (title + place). extract_text it: title, company, location, pay, must-have requirements.
2. If the user only asked to find jobs, report the matches (render_view) and stop.
3. Pick the résumé: list_files in the folder the user allowed, read_file the candidates, choose the one closest to the posting and say why. No folder allowed → upload and the user picks the file.
4. Click "Apply" / "Apply now" / "Easy apply". "Apply on company site" → follow it. A sign-in or create-account page → stop and ask the user to sign in.
5. Fill each step only with facts from the résumé or the user's request: contact details, work history, upload the résumé. Unknown answers (salary, visa, start date, references, essay questions) → ask the user; never invent. Voluntary self-identification → "Decline to answer" unless the user chose otherwise.
6. Continue / Next through the steps, then extract_text the review page and check it matches the résumé.
7. Final submit: Bah asks the user first. If they cancel, stop and report what is filled.
8. Report job, company, link and the confirmation text. Apply to no more jobs than asked.

# Initial database design

Suggested relational entities to implement next:

- `users`: id, full_name, email, password_hash, role, created_at
- `graduate_profiles`: user_id, education, graduation_date, career_interests, skills, career_goals
- `mentor_profiles`: user_id, job_title, company, industry, expertise, experience_years, bio
- `resumes`: id, graduate_id, original_filename, extracted_text, uploaded_at
- `recommendations`: id, graduate_id, mentor_id, similarity_score, generated_at
- `mentor_availability`: id, mentor_id, weekday/date, start_time, end_time
- `sessions`: id, graduate_id, mentor_id, requested_at, scheduled_for, status

Use foreign keys to connect profile records to `users`. Store password hashes only, never plaintext passwords.

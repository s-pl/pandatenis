create policy "term reports delete scoped" on public.term_reports
  for delete using (public.can_access_student(student_id));

create policy "progress evaluations update scoped" on public.progress_evaluations
  for update using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));

create policy "progress evaluations delete scoped" on public.progress_evaluations
  for delete using (public.can_access_student(student_id));

insert into library.role_policies (
  role,
  max_borrow_limit,
  default_borrow_duration_days,
  fine_threshold
)
values
('student', 3, 14, 500),
('librarian', 10, 30, 1000),
('admin', 20, 30, 10000);
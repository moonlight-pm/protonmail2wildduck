CREATE TABLE messages (
  id uuid primary key,
  mailbox text,
  i int,
  body text,
  seen bool,
  uploaded bool,
  unique (mailbox, i)
)

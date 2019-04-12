CREATE TABLE messages (
  id uuid primary key,
  mailbox text,
  uid int,
  body text,
  seen bool,
  uploaded bool,
  unique (mailbox, uid)
)

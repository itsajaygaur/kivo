UPDATE user
SET name = 'Ajay Gaur', updated_at = unixepoch() * 1000
WHERE id = 'usr_demo' AND email = 'ajay@example.com';

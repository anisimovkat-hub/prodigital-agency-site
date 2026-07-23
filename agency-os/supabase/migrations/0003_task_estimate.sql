ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS estimate_minutes integer CHECK (estimate_minutes >= 0);

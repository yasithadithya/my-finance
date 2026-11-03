-- The app now reports by pay cycle (30th → 29th), worked out in the app itself.
-- The calendar-month summary view is no longer used, so remove it to avoid confusion.
drop view if exists monthly_summary;

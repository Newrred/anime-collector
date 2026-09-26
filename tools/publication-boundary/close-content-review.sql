-- Emergency closure, not schema downgrade. Apply only to an explicitly approved environment.
-- Preserve review/notice/audit data; never restore an unclassified public reader.
begin;
update private.memory_publication_settings
set reads_enabled=false,writes_enabled=false,images_enabled=false,minihomes_enabled=false;
commit;

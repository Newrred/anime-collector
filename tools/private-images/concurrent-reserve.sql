set role service_role;
select public.reserve_memory_private_image('11111111-1111-4111-8111-111111111111',:'asset',1,:'operation','LOCAL_TEST',repeat('b',64),repeat('c',64),repeat('d',64),799000,1000,1600,1000);

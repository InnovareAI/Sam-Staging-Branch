--
-- PostgreSQL database dump
--

\restrict qT65vNnFUd8a4G1Un7amie1WLSs9bYTq9RWkSneTWiui2Nx2Etep0fJYUitHtT5

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.7 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: workspace_members; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.workspace_members (id, workspace_id, user_id, role, joined_at, linkedin_unipile_account_id, status) VALUES ('3511cd2f-a1e6-49d1-adc5-67d7e909834e', 'babdcab8-1a78-4b2f-913e-6e9fd9821009', 'f6885ff3-deef-4781-8721-93011c990b1b', 'owner', '2025-10-07 15:12:11.79102+00', NULL, 'active');
INSERT INTO public.workspace_members (id, workspace_id, user_id, role, joined_at, linkedin_unipile_account_id, status) VALUES ('39690559-2ee1-4d67-851e-aba6443fc5a6', '04666209-fce8-4d71-8eaf-01278edfc73b', '471bcb15-cc53-44f3-b5d2-4b97bb7a8b2f', 'owner', '2025-11-08 03:31:30.943649+00', NULL, 'active');
INSERT INTO public.workspace_members (id, workspace_id, user_id, role, joined_at, linkedin_unipile_account_id, status) VALUES ('5f423ab1-2d3c-4225-a81e-0360c13dc638', '96c03b38-a2f4-40de-9e16-43098599e1d4', '1949f7fc-f354-47ba-98f1-ae0a7d3b1d5d', 'owner', '2025-11-08 03:31:30.943649+00', NULL, 'active');
INSERT INTO public.workspace_members (id, workspace_id, user_id, role, joined_at, linkedin_unipile_account_id, status) VALUES ('3795bc4d-efc0-487e-95e3-e7ed373dcd66', '7f0341da-88db-476b-ae0a-fc0da5b70861', '744649a8-d015-4ff7-9e41-983cc9ca7b79', 'owner', '2025-11-08 03:31:30.943649+00', NULL, 'active');
INSERT INTO public.workspace_members (id, workspace_id, user_id, role, joined_at, linkedin_unipile_account_id, status) VALUES ('1fb2e1d7-329b-4ec2-add8-c09ef5461ecb', 'cd57981a-e63b-401c-bde1-ac71752c2293', 'a4c3ff4d-ac9c-4e84-9b35-967ce6ff8189', 'owner', '2025-11-08 03:31:30.943649+00', NULL, 'active');
INSERT INTO public.workspace_members (id, workspace_id, user_id, role, joined_at, linkedin_unipile_account_id, status) VALUES ('1cb00bf6-d3d0-4a7f-b9b2-34d9dba21672', '2a8f7c3d-9b1e-4f6a-8c2d-5e9a1b4f7d3c', 'dbbddc37-8740-4614-b448-53e0bfff2290', 'owner', '2025-11-08 03:31:30.943649+00', NULL, 'active');
INSERT INTO public.workspace_members (id, workspace_id, user_id, role, joined_at, linkedin_unipile_account_id, status) VALUES ('4efa6c80-b9b2-4923-ac4e-d3bbf7a5b255', 'c3100bea-82a6-4365-b159-6581f1be9be3', '51a05157-0aa7-42b5-a6e5-acf43d436a4b', 'owner', '2025-11-28 09:24:33.516939+00', NULL, 'active');
INSERT INTO public.workspace_members (id, workspace_id, user_id, role, joined_at, linkedin_unipile_account_id, status) VALUES ('f645db2a-f2fa-410f-a7c2-ed0dbdc3a708', 'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7', 'd518b2c7-bf3c-4112-99c5-e6c76fe27615', 'owner', '2025-11-28 09:35:08.888688+00', NULL, 'active');
INSERT INTO public.workspace_members (id, workspace_id, user_id, role, joined_at, linkedin_unipile_account_id, status) VALUES ('5cd1d119-2e90-4ded-a86f-cb91e7a7c5e3', '5b81ee67-4d41-4997-b5a4-e1432e060d12', '6a927440-ebe1-49b4-ae5e-fbee5d27944d', 'owner', '2025-12-10 18:58:00.173962+00', NULL, 'active');
INSERT INTO public.workspace_members (id, workspace_id, user_id, role, joined_at, linkedin_unipile_account_id, status) VALUES ('8aa9555a-c2cb-4166-9cc9-a1c55958ff3f', 'dea5a7f2-673c-4429-972d-6ba5fca473fb', '1d1004ef-3cc7-47b3-942d-58c86f0a27c2', 'owner', '2025-10-07 14:30:20.317+00', NULL, 'active');
INSERT INTO public.workspace_members (id, workspace_id, user_id, role, joined_at, linkedin_unipile_account_id, status) VALUES ('73d07866-debb-431c-b8fb-9381ca2e7951', 'e61966ed-18c2-425c-8e83-f466dd5902bb', 'f2bd2f15-7a77-447a-9ac2-f61a7135f5d2', 'owner', '2025-12-15 16:35:05.330572+00', NULL, 'active');
INSERT INTO public.workspace_members (id, workspace_id, user_id, role, joined_at, linkedin_unipile_account_id, status) VALUES ('abcca1d2-bb3c-468f-a179-05d0f5f60a10', '8a720935-db68-43e2-b16d-34383ec6c3e8', '57ae01f2-c1a7-4957-9277-de6998a2ac23', 'owner', '2025-12-15 19:48:47.476385+00', 'I0XZxvzfSRuCL8nuFoUEuw', 'active');


--
-- PostgreSQL database dump complete
--

\unrestrict qT65vNnFUd8a4G1Un7amie1WLSs9bYTq9RWkSneTWiui2Nx2Etep0fJYUitHtT5


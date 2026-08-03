INSERT INTO user VALUES ('usr_demo','Ajay Sharma','ajay@example.com',1,NULL,NULL,unixepoch()*1000,unixepoch()*1000);
INSERT INTO organization VALUES ('org_kivo','Acme Research','acme-research',NULL,NULL,NULL,NULL,unixepoch()*1000,unixepoch()*1000);
INSERT INTO member VALUES ('mem_owner','org_kivo','usr_demo','owner',unixepoch()*1000,unixepoch()*1000);
INSERT INTO workspace_settings(organization_id,created_at,updated_at) VALUES ('org_kivo',unixepoch()*1000,unixepoch()*1000);
INSERT INTO collection VALUES ('col_product','org_kivo','Product & Engineering','Product decisions, runbooks, and technical references.','#635bff',0,'usr_demo',NULL,unixepoch()*1000,unixepoch()*1000);
INSERT INTO document VALUES ('doc_handbook','org_kivo','col_product','Product handbook','product-handbook.md','text/markdown',12640,'demo-handbook','ready','ver_handbook','usr_demo',NULL,unixepoch()*1000,unixepoch()*1000);
INSERT INTO document_version VALUES ('ver_handbook','org_kivo','doc_handbook',1,'org_kivo/doc_handbook/ver_handbook/original','demo-handbook',18,11892,1,'ready',unixepoch()*1000,unixepoch()*1000);
INSERT INTO chunk VALUES ('chk_northstar','org_kivo','doc_handbook','ver_handbook','col_product',0,'Kivo''s north-star metric is weekly verified answers: answers opened by a teammate and positively confirmed against at least one cited source.','# North-star metric',4,0,145,'demo-chunk','chk_northstar',unixepoch()*1000,unixepoch()*1000);
